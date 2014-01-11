Feature: Public Users Feature
  Background:
    Given user "John Smith"
    Given user "Mary Jane"

  Scenario: I visit the public users area
    When I visit the public users area
    Then I should see user "John Smith"

  Scenario: I search for an user
    When I visit the public users area
    And I search for user "mary"
    Then I should see user "Mary Jane"
    And I should not see user "John Smith"
