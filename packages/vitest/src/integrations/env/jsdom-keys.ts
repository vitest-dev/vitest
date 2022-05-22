// SEE https://github.com/jsdom/jsdom/blob/master/lib/jsdom/living/interfaces.js

const LIVING_KEYS = [
  'DOMException',
  'URL',
  'URLSearchParams',
  'EventTarget',
  'NamedNodeMap',
  'Node',
  'Attr',
  'Element',
  'DocumentFragment',
  'DOMImplementation',
  'Document',
  'XMLDocument',
  'CharacterData',
  'Text',
  'CDATASection',
  'ProcessingInstruction',
  'Comment',
  'DocumentType',
  'NodeList',
  'HTMLCollection',
  'HTMLOptionsCollection',
  'DOMStringMap',
  'DOMTokenList',
  'StyleSheetList',
  'HTMLElement',
  'HTMLHeadElement',
  'HTMLTitleElement',
  'HTMLBaseElement',
  'HTMLLinkElement',
  'HTMLMetaElement',
  'HTMLStyleElement',
  'HTMLBodyElement',
  'HTMLHeadingElement',
  'HTMLParagraphElement',
  'HTMLHRElement',
  'HTMLPreElement',
  'HTMLUListElement',
  'HTMLOListElement',
  'HTMLLIElement',
  'HTMLMenuElement',
  'HTMLDListElement',
  'HTMLDivElement',
  'HTMLAnchorElement',
  'HTMLAreaElement',
  'HTMLBRElement',
  'HTMLButtonElement',
  'HTMLCanvasElement',
  'HTMLDataElement',
  'HTMLDataListElement',
  'HTMLDetailsElement',
  'HTMLDialogElement',
  'HTMLDirectoryElement',
  'HTMLFieldSetElement',
  'HTMLFontElement',
  'HTMLFormElement',
  'HTMLHtmlElement',
  'HTMLImageElement',
  'HTMLInputElement',
  'HTMLLabelElement',
  'HTMLLegendElement',
  'HTMLMapElement',
  'HTMLMarqueeElement',
  'HTMLMediaElement',
  'HTMLMeterElement',
  'HTMLModElement',
  'HTMLOptGroupElement',
  'HTMLOptionElement',
  'HTMLOutputElement',
  'HTMLPictureElement',
  'HTMLProgressElement',
  'HTMLQuoteElement',
  'HTMLScriptElement',
  'HTMLSelectElement',
  'HTMLSlotElement',
  'HTMLSourceElement',
  'HTMLSpanElement',
  'HTMLTableCaptionElement',
  'HTMLTableCellElement',
  'HTMLTableColElement',
  'HTMLTableElement',
  'HTMLTimeElement',
  'HTMLTableRowElement',
  'HTMLTableSectionElement',
  'HTMLTemplateElement',
  'HTMLTextAreaElement',
  'HTMLUnknownElement',
  'HTMLFrameElement',
  'HTMLFrameSetElement',
  'HTMLIFrameElement',
  'HTMLEmbedElement',
  'HTMLObjectElement',
  'HTMLParamElement',
  'HTMLVideoElement',
  'HTMLAudioElement',
  'HTMLTrackElement',
  'SVGElement',
  'SVGGraphicsElement',
  'SVGSVGElement',
  'SVGTitleElement',
  'SVGAnimatedString',
  'SVGNumber',
  'SVGStringList',
  'Event',
  'CloseEvent',
  'CustomEvent',
  'MessageEvent',
  'ErrorEvent',
  'HashChangeEvent',
  'PopStateEvent',
  'StorageEvent',
  'ProgressEvent',
  'PageTransitionEvent',
  'UIEvent',
  'FocusEvent',
  'InputEvent',
  'MouseEvent',
  'KeyboardEvent',
  'TouchEvent',
  'CompositionEvent',
  'WheelEvent',
  'BarProp',
  'External',
  'Location',
  'History',
  'Screen',
  'Performance',
  'Navigator',
  'PluginArray',
  'MimeTypeArray',
  'Plugin',
  'MimeType',
  'FileReader',
  'Blob',
  'File',
  'FileList',
  'ValidityState',
  'DOMParser',
  'XMLSerializer',
  'FormData',
  'XMLHttpRequestEventTarget',
  'XMLHttpRequestUpload',
  'XMLHttpRequest',
  'WebSocket',
  'NodeFilter',
  'NodeIterator',
  'TreeWalker',
  'AbstractRange',
  'Range',
  'StaticRange',
  'Selection',
  'Storage',
  'CustomElementRegistry',
  'ShadowRoot',
  'MutationObserver',
  'MutationRecord',
  'Headers',
  'AbortController',
  'AbortSignal',

  // not specified in docs, but is available
  'Image',
]

const OTHER_KEYS = [
  'addEventListener',
  'alert',
  'atob',
  'blur',
  'btoa',
  'cancelAnimationFrame',
  /* 'clearInterval', */
  /* 'clearTimeout', */
  'close',
  'confirm',
  /* 'console', */
  'createPopup',
  'dispatchEvent',
  'document',
  'focus',
  'frames',
  'getComputedStyle',
  'history',
  'innerHeight',
  'innerWidth',
  'length',
  'location',
  'matchMedia',
  'moveBy',
  'moveTo',
  'name',
  'navigator',
  'open',
  'outerHeight',
  'outerWidth',
  'pageXOffset',
  'pageYOffset',
  'parent',
  'postMessage',
  'print',
  'prompt',
  'removeEventListener',
  'requestAnimationFrame',
  'resizeBy',
  'resizeTo',
  'screen',
  'screenLeft',
  'screenTop',
  'screenX',
  'screenY',
  'scroll',
  'scrollBy',
  'scrollLeft',
  'scrollTo',
  'scrollTop',
  'scrollX',
  'scrollY',
  'self',
  /* 'setInterval', */
  /* 'setTimeout', */
  'stop',
  /* 'toString', */
  'top',
  'Window',
  'window',
]

export const KEYS = LIVING_KEYS.concat(OTHER_KEYS)
