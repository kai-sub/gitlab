import Vue, { nextTick } from 'vue';
import VueApollo from 'vue-apollo';
import { GlAlert, GlLoadingIcon } from '@gitlab/ui';

import createMockApollo from 'helpers/mock_apollo_helper';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import waitForPromises from 'helpers/wait_for_promises';

import CrudComponent from '~/vue_shared/components/crud_component.vue';
import WorkItemRelationships from '~/work_items/components/work_item_relationships/work_item_relationships.vue';
import WorkItemRelationshipList from '~/work_items/components/work_item_relationships/work_item_relationship_list.vue';
import WorkItemAddRelationshipForm from '~/work_items/components/work_item_relationships/work_item_add_relationship_form.vue';
import workItemLinkedItemsQuery from '~/work_items/graphql/work_item_linked_items.query.graphql';
import WorkItemMoreActions from '~/work_items/components/shared/work_item_more_actions.vue';
import removeLinkedItemsMutation from '~/work_items/graphql/remove_linked_items.mutation.graphql';

import {
  removeLinkedWorkItemResponse,
  workItemLinkedItemsResponse,
  workItemEmptyLinkedItemsResponse,
} from '../../mock_data';

describe('WorkItemRelationships', () => {
  Vue.use(VueApollo);

  let wrapper;

  const workItemLinkedItemsSuccessHandler = jest
    .fn()
    .mockResolvedValue(workItemLinkedItemsResponse);
  const removeLinkedWorkItemSuccessMutationHandler = jest
    .fn()
    .mockResolvedValue(removeLinkedWorkItemResponse('Successfully unlinked IDs: 2.'));
  const removeLinkedWorkItemErrorMutationHandler = jest
    .fn()
    .mockResolvedValue(removeLinkedWorkItemResponse(null, ['Linked item removal failed']));
  const $toast = {
    show: jest.fn(),
  };

  const createComponent = async ({
    workItemType = 'Task',
    workItemLinkedItemsHandler = workItemLinkedItemsSuccessHandler,
    removeLinkedWorkItemMutationHandler = removeLinkedWorkItemSuccessMutationHandler,
    canAdminWorkItemLink = true,
  } = {}) => {
    const mockApollo = createMockApollo([
      [workItemLinkedItemsQuery, workItemLinkedItemsHandler],
      [removeLinkedItemsMutation, removeLinkedWorkItemMutationHandler],
    ]);

    wrapper = shallowMountExtended(WorkItemRelationships, {
      apolloProvider: mockApollo,
      propsData: {
        workItemId: 'gid://gitlab/WorkItem/1',
        workItemIid: '1',
        workItemFullPath: 'gitlab-org/gitlab-test',
        canAdminWorkItemLink,
        workItemType,
      },
      mocks: {
        $toast,
      },
      stubs: {
        CrudComponent,
      },
    });

    await waitForPromises();
  };

  const findLoadingIcon = () => wrapper.findComponent(GlLoadingIcon);
  const findErrorMessage = () => wrapper.findComponent(GlAlert);
  const findEmptyRelatedMessageContainer = () => wrapper.findByTestId('crud-empty');
  const findLinkedItemsCountContainer = () => wrapper.findByTestId('crud-count');
  const findLinkedItemsHelpLink = () => wrapper.findByTestId('help-link');
  const findAllWorkItemRelationshipListComponents = () =>
    wrapper.findAllComponents(WorkItemRelationshipList);
  const findAddButton = () => wrapper.findByTestId('link-item-add-button');
  const findWorkItemRelationshipForm = () => wrapper.findComponent(WorkItemAddRelationshipForm);
  const findMoreActions = () => wrapper.findComponent(WorkItemMoreActions);

  it('calls workItemLinkedItemsQuery query', () => {
    createComponent();

    expect(workItemLinkedItemsSuccessHandler).toHaveBeenCalled();
  });

  it('shows loading icon when query is not processed', () => {
    createComponent();

    expect(findLoadingIcon().exists()).toBe(true);
  });

  it('renders the component with defaults if no linked items exist', async () => {
    await createComponent({
      workItemLinkedItemsHandler: jest.fn().mockResolvedValue(workItemEmptyLinkedItemsResponse),
    });

    expect(wrapper.findByTestId('work-item-relationships').exists()).toBe(true);
    expect(findEmptyRelatedMessageContainer().exists()).toBe(true);
    expect(findAddButton().exists()).toBe(true);
    expect(findWorkItemRelationshipForm().exists()).toBe(false);
    expect(findLinkedItemsHelpLink().attributes('href')).toBe(
      '/help/user/okrs.md#linked-items-in-okrs',
    );
  });

  it('renders blocking, blocked by and related to linked item lists with proper count', async () => {
    await createComponent();

    await waitForPromises();

    // renders all 3 lists: blocking, blocked by and related to
    expect(findAllWorkItemRelationshipListComponents().length).toBe(3);
    expect(findLinkedItemsCountContainer().text()).toBe('3');
  });

  it('shows an alert when list loading fails', async () => {
    const errorMessage = 'Some error';
    await createComponent({
      workItemLinkedItemsHandler: jest.fn().mockRejectedValue(new Error(errorMessage)),
    });

    expect(findErrorMessage().text()).toBe(errorMessage);
  });

  it('does not render add button when there is no permission', async () => {
    await createComponent({ canAdminWorkItemLink: false });

    expect(findAddButton().exists()).toBe(false);
  });

  it('shows form on add button and hides when cancel button is clicked', async () => {
    await createComponent();

    await findAddButton().vm.$emit('click');
    expect(findWorkItemRelationshipForm().exists()).toBe(true);

    await findWorkItemRelationshipForm().vm.$emit('cancel');
    expect(findWorkItemRelationshipForm().exists()).toBe(false);
  });

  it('removes linked item and shows toast message when removeLinkedItem event is emitted', async () => {
    await createComponent();

    expect(findLinkedItemsCountContainer().text()).toBe('3');

    await findAllWorkItemRelationshipListComponents()
      .at(0)
      .vm.$emit('removeLinkedItem', { id: 'gid://gitlab/WorkItem/2' });

    await waitForPromises();

    expect(removeLinkedWorkItemSuccessMutationHandler).toHaveBeenCalledWith({
      input: {
        id: 'gid://gitlab/WorkItem/1',
        workItemsIds: ['gid://gitlab/WorkItem/2'],
      },
    });

    expect($toast.show).toHaveBeenCalledWith('Linked item removed');

    expect(findLinkedItemsCountContainer().text()).toBe('2');
  });

  it.each`
    errorType                              | mutationMock                                               | errorMessage
    ${'an error in the mutation response'} | ${removeLinkedWorkItemErrorMutationHandler}                | ${'Linked item removal failed'}
    ${'a network error'}                   | ${jest.fn().mockRejectedValue(new Error('Network Error'))} | ${'Something went wrong when removing item. Please refresh this page.'}
  `(
    'shows an error message when there is $errorType while removing items',
    async ({ mutationMock, errorMessage }) => {
      await createComponent({
        removeLinkedWorkItemMutationHandler: mutationMock,
      });

      await findAllWorkItemRelationshipListComponents()
        .at(0)
        .vm.$emit('removeLinkedItem', { id: 'gid://gitlab/WorkItem/2' });

      await waitForPromises();

      expect(findErrorMessage().text()).toBe(errorMessage);
    },
  );

  describe('more actions', () => {
    it('renders the `WorkItemMoreActions` component', async () => {
      await createComponent();

      expect(findMoreActions().exists()).toBe(true);
    });

    it('does not render `View on a roadmap` action', async () => {
      await createComponent();

      expect(findMoreActions().props('showViewRoadmapAction')).toBe(false);
    });

    it('toggles `showLabels` when `toggle-show-labels` is emitted', async () => {
      await createComponent();

      expect(findAllWorkItemRelationshipListComponents().at(0).props('showLabels')).toBe(true);

      findMoreActions().vm.$emit('toggle-show-labels');

      await nextTick();

      expect(findAllWorkItemRelationshipListComponents().at(0).props('showLabels')).toBe(false);

      findMoreActions().vm.$emit('toggle-show-labels');

      await nextTick();

      expect(findAllWorkItemRelationshipListComponents().at(0).props('showLabels')).toBe(true);
    });
  });
});
