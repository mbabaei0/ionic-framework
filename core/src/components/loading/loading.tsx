import type { ComponentInterface, EventEmitter } from '@stencil/core';
import { Component, Element, Event, Host, Method, Prop, h } from '@stencil/core';

import { config } from '../../global/config';
import { getIonMode } from '../../global/ionic-global';
import type {
  AnimationBuilder,
  LoadingAttributes,
  OverlayEventDetail,
  OverlayInterface,
  SpinnerTypes,
} from '../../interface';
import { ENABLE_HTML_CONTENT_DEFAULT } from '../../utils/config';
import { BACKDROP, dismiss, eventMethod, prepareOverlay, present } from '../../utils/overlays';
import type { IonicSafeString } from '../../utils/sanitization';
import { sanitizeDOMString } from '../../utils/sanitization';
import { getClassMap } from '../../utils/theme';

import { iosEnterAnimation } from './animations/ios.enter';
import { iosLeaveAnimation } from './animations/ios.leave';
import { mdEnterAnimation } from './animations/md.enter';
import { mdLeaveAnimation } from './animations/md.leave';

// TODO(FW-2832): types

/**
 * @virtualProp {"ios" | "md"} mode - The mode determines which platform styles to use.
 */
@Component({
  tag: 'ion-loading',
  styleUrls: {
    ios: 'loading.ios.scss',
    md: 'loading.md.scss',
  },
  scoped: true,
})
export class Loading implements ComponentInterface, OverlayInterface {
  private customHTMLEnabled = config.get('innerHTMLTemplatesEnabled', ENABLE_HTML_CONTENT_DEFAULT);
  private durationTimeout?: ReturnType<typeof setTimeout>;

  presented = false;
  lastFocus?: HTMLElement;

  @Element() el!: HTMLIonLoadingElement;

  /** @internal */
  @Prop() overlayIndex!: number;

  /**
   * If `true`, the keyboard will be automatically dismissed when the overlay is presented.
   */
  @Prop() keyboardClose = true;

  /**
   * Animation to use when the loading indicator is presented.
   */
  @Prop() enterAnimation?: AnimationBuilder;

  /**
   * Animation to use when the loading indicator is dismissed.
   */
  @Prop() leaveAnimation?: AnimationBuilder;

  /**
   * Optional text content to display in the loading indicator.
   *
   * This property accepts custom HTML as a string.
   * Developers who only want to pass plain text
   * can disable the custom HTML functionality
   * by setting `innerHTMLTemplatesEnabled: false` in the Ionic config.
   */
  @Prop() message?: string | IonicSafeString;

  /**
   * Additional classes to apply for custom CSS. If multiple classes are
   * provided they should be separated by spaces.
   */
  @Prop() cssClass?: string | string[];

  /**
   * Number of milliseconds to wait before dismissing the loading indicator.
   */
  @Prop() duration = 0;

  /**
   * If `true`, the loading indicator will be dismissed when the backdrop is clicked.
   */
  @Prop() backdropDismiss = false;

  /**
   * If `true`, a backdrop will be displayed behind the loading indicator.
   */
  @Prop() showBackdrop = true;

  /**
   * The name of the spinner to display.
   */
  @Prop({ mutable: true }) spinner?: SpinnerTypes | null;

  /**
   * If `true`, the loading indicator will be translucent.
   * Only applies when the mode is `"ios"` and the device supports
   * [`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter#Browser_compatibility).
   */
  @Prop() translucent = false;

  /**
   * If `true`, the loading indicator will animate.
   */
  @Prop() animated = true;

  /**
   * Additional attributes to pass to the loader.
   */
  @Prop() htmlAttributes?: LoadingAttributes;

  /**
   * Emitted after the loading has presented.
   */
  @Event({ eventName: 'ionLoadingDidPresent' }) didPresent!: EventEmitter<void>;

  /**
   * Emitted before the loading has presented.
   */
  @Event({ eventName: 'ionLoadingWillPresent' }) willPresent!: EventEmitter<void>;

  /**
   * Emitted before the loading has dismissed.
   */
  @Event({ eventName: 'ionLoadingWillDismiss' }) willDismiss!: EventEmitter<OverlayEventDetail>;

  /**
   * Emitted after the loading has dismissed.
   */
  @Event({ eventName: 'ionLoadingDidDismiss' }) didDismiss!: EventEmitter<OverlayEventDetail>;

  connectedCallback() {
    prepareOverlay(this.el);
  }

  componentWillLoad() {
    if (this.spinner === undefined) {
      const mode = getIonMode(this);
      this.spinner = config.get('loadingSpinner', config.get('spinner', mode === 'ios' ? 'lines' : 'crescent'));
    }
  }

  /**
   * Present the loading overlay after it has been created.
   */
  @Method()
  async present(): Promise<void> {
    await present(this, 'loadingEnter', iosEnterAnimation, mdEnterAnimation);

    if (this.duration > 0) {
      this.durationTimeout = setTimeout(() => this.dismiss(), this.duration + 10);
    }
  }

  /**
   * Dismiss the loading overlay after it has been presented.
   *
   * @param data Any data to emit in the dismiss events.
   * @param role The role of the element that is dismissing the loading.
   * This can be useful in a button handler for determining which button was
   * clicked to dismiss the loading.
   * Some examples include: ``"cancel"`, `"destructive"`, "selected"`, and `"backdrop"`.
   */
  @Method()
  dismiss(data?: any, role?: string): Promise<boolean> {
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout);
    }
    return dismiss(this, data, role, 'loadingLeave', iosLeaveAnimation, mdLeaveAnimation);
  }

  /**
   * Returns a promise that resolves when the loading did dismiss.
   */
  @Method()
  onDidDismiss<T = any>(): Promise<OverlayEventDetail<T>> {
    return eventMethod(this.el, 'ionLoadingDidDismiss');
  }

  /**
   * Returns a promise that resolves when the loading will dismiss.
   */
  @Method()
  onWillDismiss<T = any>(): Promise<OverlayEventDetail<T>> {
    return eventMethod(this.el, 'ionLoadingWillDismiss');
  }

  private onBackdropTap = () => {
    this.dismiss(undefined, BACKDROP);
  };

  private renderLoadingMessage(msgId: string) {
    const { customHTMLEnabled, message } = this;
    if (customHTMLEnabled) {
      return <div class="loading-content" id={msgId} innerHTML={sanitizeDOMString(message)}></div>;
    }

    return (
      <div class="loading-content" id={msgId}>
        {message}
      </div>
    );
  }

  render() {
    const { message, spinner, htmlAttributes, overlayIndex } = this;
    const mode = getIonMode(this);
    const msgId = `loading-${overlayIndex}-msg`;
    /**
     * If the message is defined, use that as the label.
     * Otherwise, don't set aria-labelledby.
     */
    const ariaLabelledBy = message !== undefined ? msgId : null;

    return (
      <Host
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        tabindex="-1"
        {...(htmlAttributes as any)}
        style={{
          zIndex: `${40000 + this.overlayIndex}`,
        }}
        onIonBackdropTap={this.onBackdropTap}
        class={{
          ...getClassMap(this.cssClass),
          [mode]: true,
          'overlay-hidden': true,
          'loading-translucent': this.translucent,
        }}
      >
        <ion-backdrop visible={this.showBackdrop} tappable={this.backdropDismiss} />

        <div tabindex="0"></div>

        <div class="loading-wrapper ion-overlay-wrapper">
          {spinner && (
            <div class="loading-spinner">
              <ion-spinner name={spinner} aria-hidden="true" />
            </div>
          )}

          {message !== undefined && this.renderLoadingMessage(msgId)}
        </div>

        <div tabindex="0"></div>
      </Host>
    );
  }
}
