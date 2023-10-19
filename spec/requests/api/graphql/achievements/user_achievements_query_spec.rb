# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'UserAchievements', feature_category: :user_profile do
  include GraphqlHelpers

  let_it_be(:user) { create(:user) }
  let_it_be(:group) { create(:group, :public) }
  let_it_be(:achievement) { create(:achievement, namespace: group) }
  let_it_be(:non_revoked_achievement1) { create(:user_achievement, achievement: achievement, user: user) }
  let_it_be(:non_revoked_achievement2) { create(:user_achievement, :revoked, achievement: achievement, user: user) }
  let_it_be(:fields) do
    <<~HEREDOC
      id
      achievements {
        count
        nodes {
          userAchievements {
            count
            nodes {
              id
              achievement {
                id
              }
              user {
                id
              }
              awardedByUser {
                id
              }
              revokedByUser {
                id
              }
            }
          }
        }
      }
    HEREDOC
  end

  let(:current_user) { user }

  let(:query) do
    graphql_query_for('namespace', { full_path: group.full_path }, fields)
  end

  before_all do
    group.add_guest(user)
  end

  before do
    post_graphql(query, current_user: current_user)
  end

  it_behaves_like 'a working graphql query'

  it 'returns all non_revoked user_achievements' do
    expect(graphql_data_at(:namespace, :achievements, :nodes, :userAchievements, :nodes))
      .to contain_exactly(
        a_graphql_entity_for(non_revoked_achievement1)
      )
  end

  it 'returns the correct achievement and user_achievement counts' do
    expect(graphql_data_at(:namespace, :achievements, :count)).to be(1)
    expect(graphql_data_at(:namespace, :achievements, :nodes, :userAchievements, :count)).to contain_exactly(1)
  end

  context 'when user_achievement has priority set' do
    let_it_be(:achievement_with_priority) do
      create(:user_achievement, achievement: achievement, user: user, priority: 0)
    end

    let(:userquery_fields) do
      "userAchievements { nodes { id } }"
    end

    let(:query) do
      graphql_query_for('user', { username: user.username }, userquery_fields)
    end

    it 'returns achievements in correct order' do
      expect(graphql_data_at(:user, :userAchievements, :nodes).pluck('id')).to eq([
        achievement_with_priority.to_global_id.to_s,
        non_revoked_achievement1.to_global_id.to_s
      ])
    end
  end

  it 'can lookahead to eliminate N+1 queries', :use_clean_rails_memory_store_caching do
    control_count = ActiveRecord::QueryRecorder.new(skip_cached: false) do
      post_graphql(query, current_user: user)
    end.count

    user2 = create(:user)
    create(:user_achievement, achievement: achievement, user: user2)

    expect { post_graphql(query, current_user: user) }.not_to exceed_all_query_limit(control_count)
  end

  context 'when the achievements feature flag is disabled' do
    before do
      stub_feature_flags(achievements: false)
      post_graphql(query, current_user: user)
    end

    specify { expect(graphql_data_at(:namespace, :achievements, :nodes, :userAchievements, :nodes)).to be_empty }
  end
end
