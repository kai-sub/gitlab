# frozen_string_literal: true
module Packages
  module Npm
    class CreatePackageService < ::Packages::CreatePackageService
      include Gitlab::Utils::StrongMemoize
      include ExclusiveLeaseGuard

      PACKAGE_JSON_NOT_ALLOWED_FIELDS = %w[readme readmeFilename licenseText contributors exports].freeze
      DEFAULT_LEASE_TIMEOUT = 1.hour.to_i

      def execute
        return error('Version is empty.', 400) if version.blank?
        return error('Attachment data is empty.', 400) if attachment['data'].blank?
        return error('Package already exists.', 403) if current_package_exists?
        return error('File is too large.', 400) if file_size_exceeded?

        package = try_obtain_lease do
          ApplicationRecord.transaction { create_npm_package! }
        end

        return error('Could not obtain package lease. Please try again.', 400) unless package

        package
      end

      private

      def create_npm_package!
        package = create_package!(:npm, name: name, version: version)

        ::Packages::CreatePackageFileService.new(package, file_params).execute
        ::Packages::CreateDependencyService.new(package, package_dependencies).execute
        ::Packages::Npm::CreateTagService.new(package, dist_tag).execute

        create_npm_metadatum!(package)

        package
      end

      def create_npm_metadatum!(package)
        package.create_npm_metadatum!(package_json: package_json)
      rescue ActiveRecord::RecordInvalid => e
        if package.npm_metadatum && package.npm_metadatum.errors.where(:package_json, :too_large).any? # rubocop: disable CodeReuse/ActiveRecord
          Gitlab::ErrorTracking.track_exception(e, field_sizes: field_sizes_for_error_tracking)
        end

        raise
      end

      def current_package_exists?
        project.packages
               .npm
               .with_name(name)
               .with_version(version)
               .not_pending_destruction
               .exists?
      end

      def name
        params[:name]
      end

      def version
        params[:versions].each_key.first
      end
      strong_memoize_attr :version

      def version_data
        params[:versions][version]
      end

      def package_json
        version_data.except(*PACKAGE_JSON_NOT_ALLOWED_FIELDS)
      end

      def dist_tag
        params['dist-tags'].each_key.first
      end

      def package_file_name
        "#{name}-#{version}.tgz"
      end
      strong_memoize_attr :package_file_name

      def attachment
        params['_attachments'][package_file_name]
      end
      strong_memoize_attr :attachment

      # TODO (technical debt): Extract the package size calculation to its own component and unit test it separately.
      def calculated_package_file_size
        # This calculation is based on:
        # 1. 4 chars in a Base64 encoded string are 3 bytes in the original string. Meaning 1 char is 0.75 bytes.
        # 2. The encoded string may have 1 or 2 extra '=' chars used for padding. Each padding char means 1 byte less in the original string.
        # Reference:
        # - https://blog.aaronlenoir.com/2017/11/10/get-original-length-from-base-64-string/
        # - https://en.wikipedia.org/wiki/Base64#Decoding_Base64_with_padding
        encoded_data = attachment['data']
        ((encoded_data.length * 0.75) - encoded_data[-2..].count('=')).to_i
      end
      strong_memoize_attr :calculated_package_file_size

      def file_params
        {
          file: CarrierWaveStringFile.new(Base64.decode64(attachment['data'])),
          size: calculated_package_file_size,
          file_sha1: version_data[:dist][:shasum],
          file_name: package_file_name,
          build: params[:build]
        }
      end

      def package_dependencies
        _version, versions_data = params[:versions].first
        versions_data
      end

      def file_size_exceeded?
        project.actual_limits.exceeded?(:npm_max_file_size, calculated_package_file_size)
      end

      # used by ExclusiveLeaseGuard
      def lease_key
        "packages:npm:create_package_service:packages:#{project.id}_#{name}_#{version}"
      end

      # used by ExclusiveLeaseGuard
      def lease_timeout
        DEFAULT_LEASE_TIMEOUT
      end

      def field_sizes
        package_json.transform_values do |value|
          value.to_s.size
        end
      end
      strong_memoize_attr :field_sizes

      def filtered_field_sizes
        field_sizes.select do |_, size|
          size >= ::Packages::Npm::Metadatum::MIN_PACKAGE_JSON_FIELD_SIZE_FOR_ERROR_TRACKING
        end
      end
      strong_memoize_attr :filtered_field_sizes

      def largest_fields
        field_sizes
            .sort_by { |a| a[1] }
            .reverse[0..::Packages::Npm::Metadatum::NUM_FIELDS_FOR_ERROR_TRACKING - 1]
            .to_h
      end
      strong_memoize_attr :largest_fields

      def field_sizes_for_error_tracking
        filtered_field_sizes.empty? ? largest_fields : filtered_field_sizes
      end
    end
  end
end
