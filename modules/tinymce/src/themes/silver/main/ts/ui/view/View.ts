import {
  AlloyComponent, AlloySpec, Composite, Container, PartType, RawDomSchema, SimpleSpec,
  Sketcher, UiSketcher
} from '@ephox/alloy';
import { FieldSchema } from '@ephox/boulder';
import { View as BridgeView } from '@ephox/bridge';
import { Arr, Optional } from '@ephox/katamari';

import { UiFactoryBackstageProviders } from '../../backstage/Backstage';
import { renderButton } from '../general/Button';
import { renderTogglableIconButton } from './ViewButtons';

interface ViewHeaderSpec extends SimpleSpec {
  buttons: (BridgeView.ViewButton | BridgeView.ViewButtonsGroup)[];
  providers: UiFactoryBackstageProviders;
}

export interface ViewSketchSpec extends Sketcher.CompositeSketchSpec {
  readonly dom: RawDomSchema;
  readonly components: AlloySpec[];
  readonly viewConfig: BridgeView.View;
}

export interface ViewDetail extends Sketcher.CompositeSketchDetail {
  readonly uid: string;
  readonly dom: RawDomSchema;
  readonly components: AlloySpec[ ];
  readonly viewConfig: BridgeView.View;
}

interface ViewApis {
  readonly getPane: (comp: AlloyComponent) => Optional<AlloyComponent>;
  readonly getOnShow: (comp: AlloyComponent) => (api: BridgeView.ViewInstanceApi) => void;
  readonly getOnHide: (comp: AlloyComponent) => (api: BridgeView.ViewInstanceApi) => void;
}

type ViewButtonWithoutGroup = Exclude<BridgeView.ViewButton, BridgeView.ViewButtonsGroup>;

const renderViewButton = (spec: ViewButtonWithoutGroup, providers: UiFactoryBackstageProviders) => {
  if (spec.type === 'togglableIconButton') {
    return renderTogglableIconButton(
      {
        type: spec.type,
        text: spec.text,
        name: spec.name,
        tooltip: spec.tooltip,
        onAction: spec.onAction,
        icon: spec.icon,
        borderless: spec.borderless,
        buttonType: spec.buttonType
      },
      providers
    );
  }
  return renderButton(
    {
      text: spec.text,
      enabled: true,
      primary: false,
      name: 'name',
      icon: Optional.none(),
      borderless: false,
      buttonType: Optional.some(spec.buttonType)
    },
    (_comp) => {
      spec.onAction();
    },
    providers
  );
};

const renderButtonsGroup = (spec: BridgeView.ViewButtonsGroup, providers: UiFactoryBackstageProviders) => {
  return {
    dom: {
      tag: 'div',
      classes: [ 'tox-view__toolbar__group' ],
    },
    components: Arr.map(spec.buttons, (button) => renderViewButton(button, providers))
  };
};

const renderViewHeader = (spec: ViewHeaderSpec) => {
  let hasGroups = false;
  const endButtons = Arr.map(spec.buttons, (btnspec) => {
    if (btnspec.type === 'group') {
      hasGroups = true;
      return renderButtonsGroup(btnspec, spec.providers);
    } else {
      return renderViewButton(btnspec, spec.providers);
    }
  });

  return {
    uid: spec.uid,
    dom: {
      tag: 'div',
      classes: [ !hasGroups ? 'tox-view__header' : 'tox-view__toolbar' ]
    },
    components: hasGroups ?
      endButtons
      : [
        Container.sketch({
          dom: {
            tag: 'div',
            classes: [ 'tox-view__header-start' ]
          },
          components: []
        }),
        Container.sketch({
          dom: {
            tag: 'div',
            classes: [ 'tox-view__header-end' ]
          },
          components: endButtons
        })
      ]
  };
};

const renderViewPane = (spec: SimpleSpec) => {
  return {
    uid: spec.uid,
    dom: {
      tag: 'div',
      classes: [ 'tox-view__pane' ]
    }
  };
};

const factory: UiSketcher.CompositeSketchFactory<ViewDetail, ViewSketchSpec> = (detail, components, _spec, _externals) => {
  const apis: ViewApis = {
    getPane: (comp) => Composite.parts.getPart(comp, detail, 'pane'),
    getOnShow: (_comp) => detail.viewConfig.onShow,
    getOnHide: (_comp) => detail.viewConfig.onHide,
  };

  return {
    uid: detail.uid,
    dom: detail.dom,
    components,
    apis
  };
};

export default Sketcher.composite<ViewSketchSpec, ViewDetail, ViewApis>({
  name: 'silver.View',
  configFields: [
    FieldSchema.required('viewConfig'),
  ],
  partFields: [
    PartType.optional({
      factory: {
        sketch: renderViewHeader
      },
      schema: [
        FieldSchema.required('buttons'),
        FieldSchema.required('providers')
      ],
      name: 'header'
    }),
    PartType.optional({
      factory: {
        sketch: renderViewPane
      },
      schema: [],
      name: 'pane'
    })
  ],
  factory,
  apis: {
    getPane: (apis, comp) => apis.getPane(comp),
    getOnShow: (apis, comp) => apis.getOnShow(comp),
    getOnHide: (apis, comp) => apis.getOnHide(comp)
  }
});
