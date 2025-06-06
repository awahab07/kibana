/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Component } from 'react';
import type { GeoShapeRelation, QueryDslFieldLookup } from '@elastic/elasticsearch/lib/api/types';
import { i18n } from '@kbn/i18n';
import { Filter } from '@kbn/es-query';
import { ActionExecutionContext, Action } from '@kbn/ui-actions-plugin/public';
import { MultiPolygon, Polygon } from 'geojson';
import rison from '@kbn/rison';
import { URL_MAX_LENGTH } from '@kbn/core/public';
import { ACTION_GLOBAL_APPLY_FILTER } from '@kbn/unified-search-plugin/public';
import { buildGeoShapeFilter } from '../../../../../common/elasticsearch_util';
import { GeometryFilterForm } from '../../../../components/draw_forms/geometry_filter_form/geometry_filter_form';

// over estimated and imprecise value to ensure filter has additional room for any meta keys added when filter is mapped.
const META_OVERHEAD = 100;

interface Props {
  onClose: () => void;
  geometry?: MultiPolygon | Polygon;
  addFilters: (filters: Filter[], actionId: string) => Promise<void>;
  getFilterActions?: () => Promise<Action[]>;
  getActionContext?: () => ActionExecutionContext;
  loadPreIndexedShape?: () => Promise<QueryDslFieldLookup | null>;
  geoFieldNames: string[];
}

interface State {
  isLoading: boolean;
  errorMsg: string | undefined;
}

export class FeatureGeometryFilterForm extends Component<Props, State> {
  private _isMounted = false;
  state: State = {
    isLoading: false,
    errorMsg: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  _loadPreIndexedShape = async () => {
    if (!this.props.loadPreIndexedShape) {
      return null;
    }

    this.setState({
      isLoading: true,
    });

    let preIndexedShape;
    try {
      preIndexedShape = await this.props.loadPreIndexedShape();
    } catch (err) {
      // ignore error, just fall back to using geometry if preIndexedShape can not be fetched
    }

    if (this._isMounted) {
      this.setState({ isLoading: false });
    }

    return preIndexedShape;
  };

  _createFilter = async ({
    geometryLabel,
    relation,
  }: {
    geometryLabel: string;
    relation: GeoShapeRelation;
  }) => {
    this.setState({ errorMsg: undefined });
    const preIndexedShape = await this._loadPreIndexedShape();
    if (!this._isMounted) {
      // do not create filter if component is unmounted
      return;
    }

    const filter = buildGeoShapeFilter({
      preIndexedShape,
      geometry: this.props.geometry,
      geometryLabel,
      geoFieldNames: this.props.geoFieldNames,
      relation,
    });

    // Ensure filter will not overflow URL. Filters that contain geometry can be extremely large.
    // No elasticsearch support for pre-indexed shapes and geo_point spatial queries.
    if (
      window.location.href.length + rison.encode(filter).length + META_OVERHEAD >
      URL_MAX_LENGTH
    ) {
      this.setState({
        errorMsg: i18n.translate('xpack.maps.tooltip.geometryFilterForm.filterTooLargeMessage', {
          defaultMessage:
            'Cannot create filter. Filters are added to the URL, and this shape has too many vertices to fit in the URL.',
        }),
      });
      return;
    }

    this.props.addFilters([filter], ACTION_GLOBAL_APPLY_FILTER);
    this.props.onClose();
  };

  render() {
    return (
      <GeometryFilterForm
        buttonLabel={i18n.translate(
          'xpack.maps.tooltip.geometryFilterForm.createFilterButtonLabel',
          {
            defaultMessage: 'Create filter',
          }
        )}
        getFilterActions={this.props.getFilterActions}
        getActionContext={this.props.getActionContext}
        intitialGeometryLabel={i18n.translate(
          'xpack.maps.tooltip.geometryFilterForm.initialGeometryLabel',
          {
            defaultMessage: 'feature',
          }
        )}
        onSubmit={this._createFilter}
        isLoading={this.state.isLoading}
        errorMsg={this.state.errorMsg}
      />
    );
  }
}
