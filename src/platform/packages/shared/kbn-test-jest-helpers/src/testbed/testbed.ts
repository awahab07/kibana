/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Component as ReactComponent, ComponentType } from 'react';
import { HTMLAttributes, ReactWrapper } from 'enzyme';

import { findTestSubject } from '../find_test_subject';
import { reactRouterMock } from '../router_helpers';
import {
  mountComponentSync,
  mountComponentAsync,
  getJSXComponentWithProps,
} from './mount_component';
import {
  TestBedConfig,
  AsyncTestBedConfig,
  TestBed,
  SetupFunc,
  SyncSetupFunc,
  AsyncSetupFunc,
} from './types';

const defaultConfig: TestBedConfig = {
  defaultProps: {},
  memoryRouter: {
    wrapComponent: true,
  },
  store: null,
};

/**
 * @deprecated - use @testing-library/react instead
 *
 * Register a new Testbed to test a React Component.
 *
 * @param Component The component under test
 * @param config An optional configuration object for the Testbed
 *
 * @example
  ```typescript
  import { registerTestBed } from '@kbn/test-jest-helpers';
  import { RemoteClusterList } from '../../app/sections/remote_cluster_list';
  import { remoteClustersStore } from '../../app/store';

  const setup = registerTestBed(RemoteClusterList, { store: remoteClustersStore });

  describe('<RemoteClusterList />, () > {
    test('it should have a table', () => {
      const { exists } = setup();
      expect(exists('remoteClustersTable')).toBe(true);
    });
  });
  ```
 */
export function registerTestBed<T extends string = string, P extends object = any>(
  Component: ComponentType<P>,
  config: AsyncTestBedConfig<P>
): AsyncSetupFunc<T, Partial<P>>;
export function registerTestBed<T extends string = string, P extends object = any>(
  Component: ComponentType<P>,
  config?: TestBedConfig<P>
): SyncSetupFunc<T, Partial<P>>;
export function registerTestBed<T extends string = string, P extends object = any>(
  Component: ComponentType<P>,
  config?: AsyncTestBedConfig<P> | TestBedConfig<P>
): SetupFunc<T, Partial<P>> {
  const {
    defaultProps = defaultConfig.defaultProps,
    memoryRouter = defaultConfig.memoryRouter!,
    store = defaultConfig.store,
    doMountAsync = false,
  } = config || {};

  // Keep a reference to the React Router
  let router: any;

  const onRouter = (_router: any) => {
    router = _router;

    if (memoryRouter.onRouter) {
      memoryRouter.onRouter(_router);
    }
  };

  /**
   * In some cases, component have some logic that interacts with the react router
   * _before_ the component is mounted.(Class constructor() I'm looking at you :)
   *
   * By adding the following lines, we make sure there is always a router available
   * when instantiating the Component.
   */
  onRouter(reactRouterMock);

  const setup: SetupFunc<T> = (props) => {
    // If a function is provided we execute it
    const storeToMount = typeof store === 'function' ? store() : store!;
    const mountConfig = {
      Component,
      memoryRouter,
      store: storeToMount,
      props: {
        ...defaultProps,
        ...props,
      },
      onRouter,
    };

    if (doMountAsync) {
      return mountComponentAsync(mountConfig).then(onComponentMounted);
    }

    return onComponentMounted(mountComponentSync(mountConfig));

    // ---------------------

    function onComponentMounted(component: ReactWrapper) {
      /**
       * ----------------------------------------------------------------
       * Utils
       * ----------------------------------------------------------------
       */

      const find: TestBed<T>['find'] = (testSubject: T, sourceReactWrapper = component) => {
        const testSubjectToArray = testSubject.split('.');

        return testSubjectToArray.reduce((reactWrapper, subject, i) => {
          const target = findTestSubject(reactWrapper, subject);
          if (!target.length && i < testSubjectToArray.length - 1) {
            throw new Error(
              `Can't access nested test subject "${
                testSubjectToArray[i + 1]
              }" of unknown node "${subject}"`
            );
          }
          return target;
        }, sourceReactWrapper);
      };

      const exists: TestBed<T>['exists'] = (testSubject, count = 1) =>
        find(testSubject).length === count;

      const setProps: TestBed<T>['setProps'] = (updatedProps) => {
        if (memoryRouter.wrapComponent !== false) {
          throw new Error(
            'setProps() can only be called on a component **not** wrapped by a router route.'
          );
        }
        if (store === null) {
          return component.setProps({ ...defaultProps, ...updatedProps });
        }
        // Update the props on the Redux Provider children
        return component.setProps({
          children: getJSXComponentWithProps(Component, { ...defaultProps, ...updatedProps }),
        });
      };

      /**
       * ----------------------------------------------------------------
       * Forms
       * ----------------------------------------------------------------
       */

      const setInputValue: TestBed<T>['form']['setInputValue'] = function (input, value) {
        if (arguments.length === 3) {
          throw new Error(`Passing the "isAsync" arg is not supported anymore.`);
        }

        const formInput = typeof input === 'string' ? find(input) : input;

        if (!formInput.length) {
          throw new Error(`Input "${input}" was not found.`);
        }
        formInput.simulate('change', { target: { value } });
        component.update();
      };

      const setSelectValue: TestBed<T>['form']['setSelectValue'] = (
        select,
        value,
        doUpdateComponent = true
      ) => {
        const formSelect = typeof select === 'string' ? find(select) : select;

        if (!formSelect.length) {
          throw new Error(`Select "${select}" was not found.`);
        }

        formSelect.simulate('change', { target: { value } });

        if (doUpdateComponent) {
          component.update();
        }
      };

      const selectCheckBox: TestBed<T>['form']['selectCheckBox'] = (
        testSubject,
        isChecked = true
      ) => {
        const checkBox = find(testSubject);
        if (!checkBox.length) {
          throw new Error(`"${testSubject}" was not found.`);
        }
        checkBox.simulate('change', { target: { checked: isChecked } });
      };

      const toggleEuiSwitch: TestBed<T>['form']['toggleEuiSwitch'] = (testSubject) => {
        const checkBox = find(testSubject);
        if (!checkBox.length) {
          throw new Error(`"${testSubject}" was not found.`);
        }
        checkBox.simulate('click');
      };

      const setComboBoxValue: TestBed<T>['form']['setComboBoxValue'] = (
        comboBoxTestSubject,
        value
      ) => {
        const comboBox = find(comboBoxTestSubject);
        const formInput = findTestSubject(comboBox, 'comboBoxSearchInput');
        setInputValue(formInput, value);

        formInput.simulate('keydown', { key: 'Enter' });
        component.update();
      };

      const getErrorsMessages: TestBed<T>['form']['getErrorsMessages'] = (
        wrapper?: T | ReactWrapper
      ) => {
        let errorMessagesWrappers: ReactWrapper<HTMLAttributes, any, ReactComponent>;
        if (typeof wrapper === 'string') {
          errorMessagesWrappers = find(wrapper).find('div.euiFormErrorText');
        } else {
          errorMessagesWrappers = wrapper
            ? wrapper.find('div.euiFormErrorText')
            : component.find('div.euiFormErrorText');
        }
        return errorMessagesWrappers.map((err) => err.text());
      };

      /**
       * ----------------------------------------------------------------
       * Tables
       * ----------------------------------------------------------------
       */

      /**
       * Parse an EUI table and return meta data information about its rows and colum content.
       *
       * @param tableTestSubject The data test subject of the EUI table
       */
      const getMetaData: TestBed<T>['table']['getMetaData'] = (tableTestSubject) => {
        const table = find(tableTestSubject);

        if (!table.length) {
          throw new Error(`Eui Table "${tableTestSubject}" not found.`);
        }

        const rows = table
          .find('tr')
          .slice(1) // we remove the first row as it is the table header
          .map((row) => ({
            reactWrapper: row,
            columns: row.find('div.euiTableCellContent').map((col) => ({
              reactWrapper: col,
              // We can't access the td value with col.text() because
              // eui adds an extra div in td on mobile => (.euiTableRowCell__mobileHeader)
              value: col.find('div.euiTableCellContent').text(),
            })),
          }));

        // Also output the raw cell values, in the following format: [[td0, td1, td2], [td0, td1, td2]]
        const tableCellsValues = rows.map(({ columns }) => columns.map((col) => col.value));
        return { rows, tableCellsValues };
      };

      /**
       * ----------------------------------------------------------------
       * Router
       * ----------------------------------------------------------------
       */
      const navigateTo = (_url: string) => {
        const url =
          _url[0] === '#'
            ? _url.replace('#', '') // remove the beginning hash as the memory router does not understand them
            : _url;
        router.history.push(url);
      };

      const testBed: TestBed<T> = {
        component,
        exists,
        find,
        setProps,
        table: {
          getMetaData,
        },
        form: {
          setInputValue,
          setSelectValue,
          selectCheckBox,
          toggleEuiSwitch,
          setComboBoxValue,
          getErrorsMessages,
        },
        router: {
          navigateTo,
        },
      };

      return testBed;
    }
  };

  return setup;
}
