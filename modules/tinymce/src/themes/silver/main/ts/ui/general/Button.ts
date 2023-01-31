import {
  AddEventsBehaviour, AlloyComponent, AlloyEvents, AlloySpec, AlloyTriggers, Behaviour, Button as AlloyButton, FormField as AlloyFormField, GuiFactory, Memento, RawDomSchema, Replacing, SimpleOrSketchSpec, SketchSpec, Tabstopping
} from '@ephox/alloy';
import { Dialog, Toolbar } from '@ephox/bridge';
import { Cell, Fun, Merger, Optional } from '@ephox/katamari';

import { UiFactoryBackstage, UiFactoryBackstageProviders } from '../../backstage/Backstage';
import * as ReadOnly from '../../ReadOnly';
import { ComposingConfigs } from '../alien/ComposingConfigs';
import { DisablingConfigs } from '../alien/DisablingConfigs';
import { renderFormField } from '../alien/FieldLabeller';
import { RepresentingConfigs } from '../alien/RepresentingConfigs';
import { renderIconFromPack, renderReplaceableIconFromPack } from '../button/ButtonSlices';
import { getFetch, renderMenuButton, StoredMenuButton } from '../button/MenuButton';
import { componentRenderPipeline } from '../menus/item/build/CommonMenuItem';
import { ToolbarButtonClasses } from '../toolbar/button/ButtonClasses';
import { formActionEvent, formCancelEvent, formSubmitEvent } from './FormEvents';

type Behaviours = Behaviour.NamedConfiguredBehaviour<any, any, any>[];
type AlloyButtonSpec = Parameters<typeof AlloyButton['sketch']>[0];

type ButtonSpec = Omit<Dialog.Button, 'type'>;
type FooterButtonSpec = Omit<Dialog.DialogFooterNormalButton, 'type'> | Omit<Dialog.DialogFooterMenuButton, 'type'>;
type HeaderButtonSpec = Omit<Dialog.DialogHeaderNormalButton, 'type'> | Omit<Dialog.DialogHeaderTogglableIconButton, 'type'>;

export interface IconButtonWrapper extends Omit<ButtonSpec, 'text'> {
  readonly tooltip: Optional<string>;
}

const renderCommonSpec = (
  spec: ButtonSpec | IconButtonWrapper,
  actionOpt: Optional<(comp: AlloyComponent) => void>,
  extraBehaviours: Behaviours = [],
  dom: RawDomSchema,
  components: AlloySpec[],
  providersBackstage: UiFactoryBackstageProviders
): AlloyButtonSpec => {
  const action = actionOpt.fold(() => ({}), (action) => ({
    action
  }));

  const common = {
    buttonBehaviours: Behaviour.derive([
      DisablingConfigs.button(() => !spec.enabled || providersBackstage.isDisabled()),
      ReadOnly.receivingConfig(),
      Tabstopping.config({}),
      AddEventsBehaviour.config('button press', [
        AlloyEvents.preventDefault('click'),
        AlloyEvents.preventDefault('mousedown')
      ])
    ].concat(extraBehaviours)),
    eventOrder: {
      click: [ 'button press', 'alloy.base.behaviour' ],
      mousedown: [ 'button press', 'alloy.base.behaviour' ]
    },
    ...action
  };
  const domFinal = Merger.deepMerge(common, { dom });
  return Merger.deepMerge(domFinal, { components });
};

export const renderIconButtonSpec = (
  spec: IconButtonWrapper,
  action: Optional<(comp: AlloyComponent) => void>,
  providersBackstage: UiFactoryBackstageProviders,
  extraBehaviours: Behaviours = []
): AlloyButtonSpec => {
  const tooltipAttributes = spec.tooltip.map<{}>((tooltip) => ({
    'aria-label': providersBackstage.translate(tooltip),
    'title': providersBackstage.translate(tooltip)
  })).getOr({});
  const dom = {
    tag: 'button',
    classes: [ ToolbarButtonClasses.Button ],
    attributes: tooltipAttributes
  };
  const icon = spec.icon.map((iconName) => renderIconFromPack(iconName, providersBackstage.icons));
  const components = componentRenderPipeline([
    icon
  ]);
  return renderCommonSpec(spec, action, extraBehaviours, dom, components, providersBackstage);
};

export const renderIconButton = (
  spec: IconButtonWrapper,
  action: (comp: AlloyComponent) => void,
  providersBackstage: UiFactoryBackstageProviders,
  extraBehaviours: Behaviours = []
): SketchSpec => {
  const iconButtonSpec = renderIconButtonSpec(spec, Optional.some(action), providersBackstage, extraBehaviours);
  return AlloyButton.sketch(iconButtonSpec);
};

const calculateClassesFromButtonType = (buttonType: 'primary' | 'secondary' | 'toolbar') => {
  switch (buttonType) {
    case 'primary':
      return [ 'tox-button' ];
    case 'toolbar':
      return [ 'tox-tbtn' ];
    case 'secondary':
    default:
      return [ 'tox-button', 'tox-button--secondary' ];
  }
};

// Maybe the list of extraBehaviours is better than doing a Merger.deepMerge that
// we do elsewhere? Not sure.
export const renderButtonSpec = (
  spec: ButtonSpec,
  action: Optional<(comp: AlloyComponent) => void>,
  providersBackstage: UiFactoryBackstageProviders,
  extraBehaviours: Behaviours = [],
  extraClasses: string[] = []
): AlloyButtonSpec => {
  const translatedText = providersBackstage.translate(spec.text);

  const icon = spec.icon.map((iconName) => renderIconFromPack(iconName, providersBackstage.icons));
  const translatedTextComponed = GuiFactory.text(translatedText);
  const components = !spec.showIconAndText
    ? [ icon.getOrThunk(Fun.constant(translatedTextComponed)) ]
    : icon.fold(
      Fun.constant([ translatedTextComponed ]),
      (iconComp) => [ iconComp, translatedTextComponed ]
    );

  // The old default is based on the now-deprecated 'primary' property. `buttonType` takes precedence now.
  const buttonType = spec.buttonType.getOr(!spec.primary && !spec.borderless ? 'secondary' : 'primary');

  const baseClasses = calculateClassesFromButtonType(buttonType);

  const classes = [
    ...baseClasses,
    ...icon.isSome() ? [ 'tox-button--icon' ] : [],
    ...spec.borderless ? [ 'tox-button--naked' ] : [],
    ...spec.showIconAndText ? [ 'tox-button--icon-and-text' ] : [],
    ...extraClasses
  ];

  const dom = {
    tag: 'button',
    classes,
    attributes: {
      title: translatedText // TODO: tooltips AP-213
    }
  };
  return renderCommonSpec(spec, action, extraBehaviours, dom, components, providersBackstage);
};

export const renderButton = (
  spec: ButtonSpec,
  action: (comp: AlloyComponent) => void,
  providersBackstage: UiFactoryBackstageProviders,
  extraBehaviours: Behaviours = [],
  extraClasses: string[] = []
): SketchSpec => {
  const buttonSpec = renderButtonSpec(spec, Optional.some(action), providersBackstage, extraBehaviours, extraClasses);
  return AlloyButton.sketch(buttonSpec);
};

const getAction = (name: string, buttonType: string) => (comp: AlloyComponent) => {
  if (buttonType === 'custom') {
    AlloyTriggers.emitWith(comp, formActionEvent, {
      name,
      value: { }
    });
  } else if (buttonType === 'submit') {
    AlloyTriggers.emit(comp, formSubmitEvent);
  } else if (buttonType === 'cancel') {
    AlloyTriggers.emit(comp, formCancelEvent);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unknown button type: ', buttonType);
  }
};

const isMenuFooterButtonSpec = (spec: FooterButtonSpec | HeaderButtonSpec, buttonType: string): spec is Dialog.DialogFooterMenuButton => buttonType === 'menu';

const isNormalFooterButtonSpec = (spec: FooterButtonSpec | HeaderButtonSpec, buttonType: string): spec is Dialog.DialogFooterNormalButton | Dialog.DialogHeaderNormalButton => buttonType === 'custom' || buttonType === 'cancel' || buttonType === 'submit';

const isTogglableIconButton = (spec: FooterButtonSpec | HeaderButtonSpec, buttonType: string): spec is Dialog.DialogHeaderTogglableIconButton => buttonType === 'customTogglableIcon';

const renderTogglableIconButton = (spec: Dialog.DialogHeaderTogglableIconButton, backstage: UiFactoryBackstage): SimpleOrSketchSpec => {
  const optMemIcon = Optional.some(spec.icon)
    .map((iconName) => renderReplaceableIconFromPack(iconName, backstage.shared.providers.icons))
    .map(Memento.record);
  const currentStatus = Cell('normal');

  const action = (comp: AlloyComponent) => {
    AlloyTriggers.emitWith(comp, formActionEvent, {
      name: spec.name,
      value: {
        getStatus: currentStatus.get,
        setStatus: (newStatus: string) => {
          optMemIcon.bind((mem) => mem.getOpt(comp)).each((displayIcon) => {
            if (newStatus === 'normal') {
              Replacing.set(displayIcon, [
                renderReplaceableIconFromPack(spec.icon ?? '', backstage.shared.providers.icons)
              ]);
            } else {
              Replacing.set(displayIcon, [
                renderReplaceableIconFromPack(spec.toggledIcon ?? '', backstage.shared.providers.icons)
              ]);
            }
            currentStatus.set(newStatus);
          });
        }
      }
    });
  };

  const buttonSpec: IconButtonWrapper = {
    ...spec,
    tooltip: Optional.from(spec.text),
    icon: Optional.from(spec.name),
    borderless: false
  };

  const tooltipAttributes = buttonSpec.tooltip.map<{}>((tooltip) => ({
    'aria-label': backstage.shared.providers.translate(tooltip),
    'title': backstage.shared.providers.translate(tooltip)
  })).getOr({});
  const dom = {
    tag: 'button',
    classes: [ ToolbarButtonClasses.Button ],
    attributes: tooltipAttributes
  };
  const components = optMemIcon.map((memIcon) => componentRenderPipeline([ Optional.some(memIcon.asSpec()) ])).getOr([]);
  const iconButtonSpec = renderCommonSpec(buttonSpec, Optional.some(action), [], dom, components, backstage.shared.providers);
  return AlloyButton.sketch(iconButtonSpec);
};

export const renderFooterButton = (spec: FooterButtonSpec | HeaderButtonSpec, buttonType: string, backstage: UiFactoryBackstage): SimpleOrSketchSpec => {
  if (isMenuFooterButtonSpec(spec, buttonType)) {
    const getButton = () => memButton;

    const menuButtonSpec = spec as StoredMenuButton;

    const fixedSpec: Toolbar.ToolbarMenuButton = {
      ...spec,
      type: 'menubutton',
      // Currently, dialog-based menu buttons cannot be searchable.
      search: Optional.none(),
      onSetup: (api) => {
        api.setEnabled(spec.enabled);
        return Fun.noop;
      },
      fetch: getFetch(menuButtonSpec.items, getButton, backstage)
    };

    const memButton = Memento.record(renderMenuButton(fixedSpec, ToolbarButtonClasses.Button, backstage, Optional.none()));

    return memButton.asSpec();
  } else if (isNormalFooterButtonSpec(spec, buttonType)) {
    const action = getAction(spec.name, buttonType);
    const buttonSpec = {
      ...spec,
      borderless: false
    };
    return renderButton(buttonSpec, action, backstage.shared.providers, [ ]);
  } else if (isTogglableIconButton(spec, buttonType)) {
    const buttonSpec: Dialog.DialogHeaderTogglableIconButton = {
      ...spec,
      tooltip: spec.name
    };
    return renderTogglableIconButton(buttonSpec, backstage);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unknown footer button type: ', buttonType);
    throw new Error('Unknown footer button type');
  }
};

export const renderDialogButton = (spec: ButtonSpec, providersBackstage: UiFactoryBackstageProviders): SketchSpec => {
  const action = getAction(spec.name, 'custom');
  return renderFormField(Optional.none(), AlloyFormField.parts.field({
    factory: AlloyButton,
    ...renderButtonSpec(spec, Optional.some(action), providersBackstage, [
      RepresentingConfigs.memory(''),
      ComposingConfigs.self()
    ])
  }));
};
