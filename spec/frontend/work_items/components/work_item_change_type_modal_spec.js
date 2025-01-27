import { GlModal, GlFormSelect } from '@gitlab/ui';
import Vue, { nextTick } from 'vue';
import VueApollo from 'vue-apollo';

import namespaceWorkItemTypesQueryResponse from 'test_fixtures/graphql/work_items/namespace_work_item_types.query.graphql.json';
import createMockApollo from 'helpers/mock_apollo_helper';
import { mountExtended } from 'helpers/vue_test_utils_helper';
import waitForPromises from 'helpers/wait_for_promises';
import { stubComponent } from 'helpers/stub_component';

import WorkItemChangeTypeModal from '~/work_items/components/work_item_change_type_modal.vue';
import namespaceWorkItemTypesQuery from '~/work_items/graphql/namespace_work_item_types.query.graphql';
import convertWorkItemMutation from '~/work_items/graphql/work_item_convert.mutation.graphql';
import getWorkItemDesignListQuery from '~/work_items/components/design_management/graphql/design_collection.query.graphql';
import {
  WORK_ITEM_TYPE_ENUM_KEY_RESULT,
  WORK_ITEM_TYPE_VALUE_KEY_RESULT,
  WORK_ITEM_TYPE_VALUE_TASK,
  WORK_ITEM_TYPE_VALUE_ISSUE,
  WORK_ITEM_WIDGETS_NAME_MAP,
} from '~/work_items/constants';

import {
  convertWorkItemMutationResponse,
  workItemChangeTypeWidgets,
  workItemQueryResponse,
} from '../mock_data';
import { designCollectionResponse, mockDesign } from './design_management/mock_data';

describe('WorkItemChangeTypeModal component', () => {
  Vue.use(VueApollo);

  let wrapper;

  const typesQuerySuccessHandler = jest.fn().mockResolvedValue(namespaceWorkItemTypesQueryResponse);
  const keyResultTypeId =
    namespaceWorkItemTypesQueryResponse.data.workspace.workItemTypes.nodes.find(
      (type) => type.name === WORK_ITEM_TYPE_VALUE_KEY_RESULT,
    ).id;

  const convertWorkItemMutationSuccessHandler = jest
    .fn()
    .mockResolvedValue(convertWorkItemMutationResponse);
  const graphqlError = 'GraphQL error';
  const convertWorkItemMutationErrorResponse = {
    errors: [
      {
        message: graphqlError,
      },
    ],
    data: {
      workItemConvert: null,
    },
  };
  const noDesignQueryHandler = jest.fn().mockResolvedValue(designCollectionResponse([]));
  const oneDesignQueryHandler = jest.fn().mockResolvedValue(designCollectionResponse([mockDesign]));

  const createComponent = ({
    hasOkrsFeature = true,
    okrsMvc = true,
    hasParent = false,
    hasChildren = false,
    widgets = [],
    workItemType = WORK_ITEM_TYPE_VALUE_TASK,
    convertWorkItemMutationHandler = convertWorkItemMutationSuccessHandler,
    designQueryHandler = noDesignQueryHandler,
  } = {}) => {
    wrapper = mountExtended(WorkItemChangeTypeModal, {
      apolloProvider: createMockApollo([
        [namespaceWorkItemTypesQuery, typesQuerySuccessHandler],
        [convertWorkItemMutation, convertWorkItemMutationHandler],
        [getWorkItemDesignListQuery, designQueryHandler],
      ]),
      propsData: {
        workItemId: 'gid://gitlab/WorkItem/1',
        fullPath: 'gitlab-org/gitlab-test',
        hasParent,
        hasChildren,
        widgets,
        workItemType,
        allowedChildTypes: [{ name: WORK_ITEM_TYPE_VALUE_TASK }],
      },
      provide: {
        hasOkrsFeature,
        glFeatures: {
          okrsMvc,
        },
      },
      stubs: {
        GlModal: stubComponent(GlModal, {
          template:
            '<div><slot name="modal-title"></slot><slot></slot><slot name="modal-footer"></slot></div>',
        }),
      },
    });
  };

  const findChangeTypeModal = () => wrapper.findComponent(GlModal);
  const findGlFormSelect = () => wrapper.findComponent(GlFormSelect);
  const findWarningAlert = () => wrapper.findByTestId('change-type-warning-message');
  const findErrorAlert = () => wrapper.findByTestId('change-type-error-message');
  const findConfirmationButton = () => wrapper.findByTestId('change-type-confirmation-button');

  beforeEach(async () => {
    createComponent();
    await waitForPromises();
  });

  it('renders change type modal with the select', () => {
    expect(findChangeTypeModal().exists()).toBe(true);
    expect(findGlFormSelect().exists()).toBe(true);
    expect(findConfirmationButton().props('disabled')).toBe(true);
  });

  it('calls the `namespaceWorkItemTypesQuery` to get the work item types', () => {
    expect(typesQuerySuccessHandler).toHaveBeenCalled();
  });

  it('renders all types as select options', () => {
    expect(findGlFormSelect().findAll('option')).toHaveLength(4);
  });

  it('does not render objective and key result if `okrsMvc` is disabled', () => {
    createComponent({ okrsMvc: false });

    expect(findGlFormSelect().findAll('option')).toHaveLength(2);
  });

  it('does not allow to change type and disables `Change type` button when the work item has a parent', async () => {
    createComponent({ hasParent: true, widgets: workItemQueryResponse.data.workItem.widgets });

    findGlFormSelect().vm.$emit('change', WORK_ITEM_TYPE_ENUM_KEY_RESULT);

    await nextTick();

    expect(findWarningAlert().text()).toBe(
      'Parent item type issue is not supported on key result. Remove the parent item to change type.',
    );

    expect(findConfirmationButton().props('disabled')).toBe(true);
  });

  it('does not allow to change type and disables `Change type` button when the work item has child items', async () => {
    createComponent({ workItemType: WORK_ITEM_TYPE_VALUE_ISSUE, hasChildren: true });

    findGlFormSelect().vm.$emit('change', WORK_ITEM_TYPE_ENUM_KEY_RESULT);

    await nextTick();

    expect(findWarningAlert().text()).toBe(
      'Key result does not support the task child item types. Remove child items to change type.',
    );
    expect(findConfirmationButton().props('disabled')).toBe(true);
  });

  describe('when widget data has difference', () => {
    it('shows warning message in case of designs', async () => {
      createComponent({
        workItemType: WORK_ITEM_TYPE_VALUE_ISSUE,
        designQueryHandler: oneDesignQueryHandler,
      });

      await waitForPromises();

      findGlFormSelect().vm.$emit('change', WORK_ITEM_TYPE_ENUM_KEY_RESULT);

      await nextTick();

      expect(findWarningAlert().text()).toContain('Design');
      expect(findConfirmationButton().props('disabled')).toBe(false);
    });

    // These are all possible use cases of conflicts among project level work items
    // Other widgets are shared between all the work item types
    it.each`
      widgetType                                  | widgetData                                 | workItemType                  | typeTobeConverted                 | expectedString
      ${WORK_ITEM_WIDGETS_NAME_MAP.MILESTONE}     | ${workItemChangeTypeWidgets.MILESTONE}     | ${WORK_ITEM_TYPE_VALUE_TASK}  | ${WORK_ITEM_TYPE_ENUM_KEY_RESULT} | ${'Milestone'}
      ${WORK_ITEM_WIDGETS_NAME_MAP.DEVELOPMENT}   | ${workItemChangeTypeWidgets.DEVELOPMENT}   | ${WORK_ITEM_TYPE_VALUE_ISSUE} | ${WORK_ITEM_TYPE_ENUM_KEY_RESULT} | ${'Development'}
      ${WORK_ITEM_WIDGETS_NAME_MAP.CRM_CONTACTS}  | ${workItemChangeTypeWidgets.CRM_CONTACTS}  | ${WORK_ITEM_TYPE_VALUE_ISSUE} | ${WORK_ITEM_TYPE_ENUM_KEY_RESULT} | ${'Contacts'}
      ${WORK_ITEM_WIDGETS_NAME_MAP.TIME_TRACKING} | ${workItemChangeTypeWidgets.TIME_TRACKING} | ${WORK_ITEM_TYPE_VALUE_ISSUE} | ${WORK_ITEM_TYPE_ENUM_KEY_RESULT} | ${'Time tracking'}
    `(
      'shows warning message in case of $widgetType widget',
      async ({ workItemType, widgetData, typeTobeConverted, expectedString }) => {
        createComponent({
          workItemType,
          widgets: [widgetData],
        });

        await waitForPromises();

        findGlFormSelect().vm.$emit('change', typeTobeConverted);

        await nextTick();

        expect(findWarningAlert().text()).toContain(expectedString);
        expect(findConfirmationButton().props('disabled')).toBe(false);
      },
    );
  });

  describe('convert work item mutation', () => {
    it('successfully changes a work item type when conditions are met', async () => {
      createComponent();

      await waitForPromises();

      findGlFormSelect().vm.$emit('change', WORK_ITEM_TYPE_ENUM_KEY_RESULT);

      await nextTick();

      findConfirmationButton().vm.$emit('click');

      await waitForPromises();

      expect(convertWorkItemMutationSuccessHandler).toHaveBeenCalledWith({
        input: {
          id: 'gid://gitlab/WorkItem/1',
          workItemTypeId: keyResultTypeId,
        },
      });
    });

    it.each`
      errorType          | expectedErrorMessage      | failureHandler
      ${'graphql error'} | ${graphqlError}           | ${jest.fn().mockResolvedValue(convertWorkItemMutationErrorResponse)}
      ${'network error'} | ${'Error: Network error'} | ${jest.fn().mockRejectedValue(new Error('Network error'))}
    `(
      'emits an error when there is a $errorType',
      async ({ expectedErrorMessage, failureHandler }) => {
        createComponent({
          convertWorkItemMutationHandler: failureHandler,
        });

        await waitForPromises();

        findGlFormSelect().vm.$emit('change', WORK_ITEM_TYPE_ENUM_KEY_RESULT);

        await nextTick();

        findConfirmationButton().vm.$emit('click');

        await waitForPromises();

        expect(findErrorAlert().text()).toContain(expectedErrorMessage);
      },
    );
  });
});
