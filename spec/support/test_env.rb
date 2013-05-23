require 'rspec/mocks'

module TestEnv
  extend self

  # Test environment
  #
  # all repositories and namespaces stored at
  # RAILS_APP/tmp/test-git-base-path
  #
  # Next shell methods are stubbed and return true
  # -  mv_repository
  # -  remove_repository
  # -  add_key
  # -  remove_key
  #
  def init(opts = {})
    RSpec::Mocks::setup(self)

    # Disable observers to improve test speed
    #
    # You can enable it in whole test case where needed by next string:
    #
    #   before(:each) { enable_observers }
    #
    disable_observers if opts[:observers] == false

    # Disable mailer for spinach tests
    disable_mailer if opts[:mailer] == false


    # Use tmp dir for FS manipulations
    repos_path = Rails.root.join('tmp', 'test-git-base-path')
    Gitlab.config.gitlab_shell.stub(repos_path: repos_path)
    Gitlab::Git::Repository.stub(repos_path: repos_path)

    GollumWiki.any_instance.stub(:init_repo) do |path|
      create_temp_repo(File.join(repos_path, "#{path}.git"))
    end

    Gitlab::Shell.any_instance.stub(
      add_repository: true,
      mv_repository: true,
      remove_repository: true,
      add_key: true,
      remove_key: true
    )

    Gitlab::Satellite::Satellite.any_instance.stub(
      exists?: true,
      destroy: true,
      create: true,
    )

    MergeRequest.any_instance.stub(
      check_if_can_be_merged: true
    )

    Repository.any_instance.stub(
      size: 12.45
    )

    # Remove tmp/test-git-base-path
    FileUtils.rm_rf Gitlab.config.gitlab_shell.repos_path

    # Recreate tmp/test-git-base-path
    FileUtils.mkdir_p Gitlab.config.gitlab_shell.repos_path

    # Symlink tmp/repositories/gitlabhq to tmp/test-git-base-path/gitlabhq
    seed_repo = Rails.root.join('tmp', 'repositories', 'gitlabhq')

    #TODO:[IA-07]probably should think about this some more
    main_test_repo = File.join(repos_path, 'gitlabhq.git')
    source_repo = File.join(repos_path, 'source_gitlabhq.git')
    target_repo = File.join(repos_path, 'target_gitlabhq.git')
    system("ln -s #{seed_repo} #{main_test_repo}")
    system("ln -s #{seed_repo} #{source_repo}")
    system("ln -s #{seed_repo} #{target_repo}")

    #Since much more is happening in satellites
    satellite_path = "#{repos_path}/satellite"
    satellite_seed_repo = Rails.root.join('tmp', 'repositories', 'seed-gitlabhq')
    Gitlab.config.satellites.stub(path: satellite_path)
    FileUtils.mkdir_p Gitlab.config.satellites.path
    main_test_satellite = File.join(satellite_path, 'gitlabhq')
    source_satellite = File.join(satellite_path, 'source_gitlabhq')
    target_satellite = File.join(satellite_path, 'target_gitlabhq')
    FileUtils.mkdir_p main_test_satellite
    system("git clone --quiet #{main_test_repo} #{main_test_satellite}")
    FileUtils.mkdir_p source_satellite
    system("git clone --quiet #{source_repo} #{source_satellite}")
    FileUtils.mkdir_p target_satellite
    system("git clone --quiet #{target_repo} #{target_satellite}")

  end

  def create_temp_repo(path)
    FileUtils.mkdir_p path
    command = "git init --quiet --bare #{path};"
    system(command)
  end

  def enable_observers
    ActiveRecord::Base.observers.enable(:all)
  end

  def disable_observers
    ActiveRecord::Base.observers.disable(:all)
  end

  def disable_mailer
    NotificationService.any_instance.stub(mailer: double.as_null_object)
  end
end
