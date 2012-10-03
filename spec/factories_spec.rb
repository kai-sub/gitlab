require 'spec_helper'

FactoryGirl.factories.map(&:name).each do |factory_name|
  next if :key_with_a_space_in_the_middle == factory_name
  describe "#{factory_name} factory" do
    it 'should be valid' do
      build(factory_name).should be_valid
    end
  end
end
