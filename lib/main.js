/**
 * Build styles
 */
import './index.scss';
import { _getFrontOffset, selection, _getRealDomAndOffset } from './utils/string';
import { IconBrackets, IconStar, IconEtcHorisontal } from '@codexteam/icons';
const getFrontOffset = _getFrontOffset();
const getRealDomAndOffset = _getRealDomAndOffset();
// import copysvg from './svg/copy.svg';
// import successcopy from './svg/deal.svg';
// import select from './svg/select.svg';
import { copysvg, successcopy, select } from './svg/svg';
export default class CodeTool {
  /**
   * Notify core this read-only mode is supported
   *
   * @returns {boolean}
   */
  static get isReadOnlySupported() {
    return true;
  }

  /**
   * Allow to press Enter inside the CodeTool div
   *
   * @returns {boolean}
   * @public
   */
  static get enableLineBreaks() {
    return true;
  }

  get defaultLanguages() {
    return ['纯文本', 'Css', 'Python', 'Git', 'JavaScript', 'Go', 'C', 'C++', 'Rust', 'Java']
  }

  /**
   * @typedef {object} CodeData — plugin saved data
   * @property {string} code - previously saved plugin code
   */

  /**
   * Render plugin`s main Element and fill it with saved data
   *
   * @param {object} options - tool constricting options
   * @param {CodeData} options.data — previously saved plugin code
   * @param {object} options.config - user config for Tool
   * @param {object} options.api - Editor.js API
   * @param {boolean} options.readOnly - read only mode flag
   */
  constructor({ data, config, api, readOnly, block }) {
    this.api = api;
    this.block = block;
    this.readOnly = readOnly;

    this.placeholder = this.api.i18n.t(config.placeholder || CodeTool.DEFAULT_PLACEHOLDER);

    // 点击时的滚动事件
    this.dragMove = config.dragMoveer.dragMove;

    // 双击时的

    this.dragDbclick = config.dragMoveer.dragDbclick;

    this.CSS = {
      baseClass: this.api.styles.block,
      input: this.api.styles.input,
      wrapper: 'code-plus',
      div: 'code-plus__inside',
      svgWrapper: 'code-plus-svg-wrapper',
      divOutside: 'code-plus__outside',
      language: 'code-plus-language',
    };

    this.nodes = {
      holder: null,
      div: null,
      languageText: null,
      codePlusLibraryMenu: null,
      languageMenu: null,
      languageOutside: null,
      languageOptions: null,
      input: null,
      languageOptionContainer: null,
      outside_container: null,
      drag: null
    };

    this.config = config;

    this.data = {
      code: data.code || '',
      language: data.language || config.defaultLanguage,
      lineNumber: data.lineNumber || 0,
      minWidth: data.width || config.minWidth,
      contentHeight: data.contentHeight || 0,
      title: data.title,
      word_wrap: typeof data.word_wrap !== 'undefined' ? data.word_wrap : config.word_wrap,
      lineHeights: typeof data.lineHeights !== 'undefined' ? data.lineHeights : [],
      unfold: typeof data.unfold !== 'undefined' ? data.unfold : config.unfold,
    };

    console.log(this.data, data, config, 'data')

    this.languages = config.languages || this.defaultLanguages();

    this.highlighter = config.highlighter

    console.log(config.highlighter, 'config.highlighter')



    this.range = null;
    this.selection = null;
    this.isEnterPress = false;

    this.isInput = true;

    this.displayLineNumber = true;

    this.dragState = {
      'startMouseTop': 0,
      'endMouseTop': 0,
    }
    this.TextAreaWrap = {
      MinHeight: 440,
      MaxHeight: this.data.lineNumber
    }

    this.nodes.holder = this.drawView();
  }
  /**
   * Create Tool's view
   *
   * @returns {HTMLElement}
   * @private
   */
  drawView() {

    const wrapper = this.make('div', [this.CSS.baseClass, this.CSS.wrapper]),
      inside = this.make('div', [this.CSS.div, this.CSS.input]),
      outside_container = this.make('div', ['code-plus-outside-container']),
      drag = this.make('div', 'code-plus-drag'),
      dragBack = this.make('div', 'code-plus-drag-back'),
      outside = this.make('div', [this.CSS.divOutside]),
      lineNumbers = this.make('div', ['code-plus-line-number-es']),
      lineNumberSizer = this.make('span', '');

    wrapper.style.position = "relative";
    inside.setAttribute("contenteditable", "true");
    inside.setAttribute("spellcheck", false)
    inside.setAttribute("data-placeholder", this.placeholder);

    if (this.data.language && this.data.language !== '纯文本') {
      inside.innerHTML = this.replaceSuperFluous(this.generateHtml(this.data.language.toLocaleLowerCase()))
    } else {
      inside.textContent = this.data.code;
    }


    this.nodes.lineNumberSizer = lineNumberSizer;
    inside.appendChild(lineNumberSizer);

    if (this.readOnly) {
      inside.setAttribute("contenteditable", false);
    }

    const languageMenu = this.makeLanguageMenu();

    this.nodes.lineNumbers = lineNumbers;
    outside.appendChild(lineNumbers);

    outside.appendChild(inside);

    wrapper.appendChild(languageMenu);


    this.nodes.outside = outside;

    console.log(this.data.unfold)
    // 是否展开
    if (this.data.unfold) {
      outside.style.maxHeight = 'none';
    }
    outside_container.appendChild(outside);


    dragBack.appendChild(drag);
    this.nodes.outside_container = outside_container;

    this.nodes.drag = drag;
    this.nodes.dragBack = dragBack;

    // 当是开始生成一个code时
    if (this.data.contentHeight === 0) {
      this.removeDragBack();
      this.removeMask()
    }

    if (this.data.contentHeight > 0) {
      // 说明是已经生成了代码的大致内容了
      // 如果设置了展开
      if (this.data.unfold) {
        this.removeMask();
      }

      // 没有设置展开

      if (!this.data.unfold) {
        // 看代码是不是超出范围了
        if ((this.data.contentHeight - 40) < this.data.lineNumber) {
          this.addMask();
        }

        if ((this.data.contentHeight - 40) >= this.data.lineNumber) {
          this.removeMask()
        }
      }

      // 看是不是要生成拖拽条
      if (this.data.lineNumber > 440) {
        this.addDragBack();
      }
    }


    let clickNumber = 0;
    let timer = null;
    dragBack.addEventListener('click', (ev) => {
      clickNumber += 1;
      if (clickNumber === 2) {
        clickNumber = 0;
        const currentBlock = this.api.blocks.getCurrentBlockIndex();
        const currentBlockId = this.api.blocks.getBlockByIndex(currentBlock);

        if (outside.style.maxHeight === 'none') {
          // 收起
          outside.style.maxHeight = '440px';
          this.data.unfold = false;
          if (!this.data.unfold && (this.nodes.outside.clientHeight < this.nodes.div.clientHeight)) {
            this.addMask();
          }
          // this.dragDbclick(ev.target, false, this.data.contentHeight, currentBlockId.holder);

        } else {
          // 展开
          outside.style.maxHeight = 'none';
          this.data.unfold = true;
          if ((this.nodes.outside.clientHeight >= this.nodes.div.clientHeight)) {
            this.removeMask();
          }
          // this.dragDbclick(ev.target, true);

        }


      }
      timer = setTimeout(() => {
        clickNumber = 0;
        clearTimeout(timer)
      }, 1000)
      ev.stopPropagation();
      ev.preventDefault();
      // 取消选择文本
      window.getSelection().removeAllRanges();

      // 当前点击的元素,是否展开
    })

    // dragBack.addEventListener('mousedown', (ev) => {
    //   document.onselectstart = () => false;
    //   document.ondragstart = () => false;

    //   this.dragState = {
    //     // 鼠标开始移动的位置（Y轴）
    //     'startMouseTop': ev.clientY,
    //     // 鼠标最后移动的位置（Y轴）
    //     'endMouseTop': ev.clientY
    //   }

    //   ev.target.style.cursor = 'ns-resize'

    //   // 绑定鼠标移动事件
    //   document.addEventListener('mousemove', handleMouseMove);
    //   // 绑定鼠标放开事件
    //   document.addEventListener('mouseup', handleMouseUp);

    // })

    // const that = this
    // function handleMouseMove(event) {
    //   const rResizeLine = that.nodes.dragBack;
    //   const rTextareaWrap = outside;
    //   const TextAreaWrap = that.TextAreaWrap;

    //   // 获取鼠标最后移动的位置（Y轴）
    //   const { endMouseTop } = that.dragState;
    //   // 获取当前的文本框高度
    //   const oldTextAreaHeight = rTextareaWrap.getBoundingClientRect().height;
    //   // 新的文本框高度
    //   let newTextAreaHeight = 0;

    //   // 计算鼠标移动的距离
    //   const distance = Math.abs(
    //     parseInt(((endMouseTop - event.clientY) * 100).toString(), 10) / 100
    //   );

    //   // 若鼠标向下移动
    //   if (endMouseTop <= event.clientY) {
    //     // 发送框高度达到最大
    //     if (oldTextAreaHeight >= (TextAreaWrap.MaxHeight + 40)) {
    //       that.dragMove({ direction: 'down', end: true, event, distance: 0 })

    //       // 修改光标为可被向上移动
    //       rResizeLine.style.cursor = 'n-resize';

    //       that.nodes.dragBack.style.backgroundImage = 'none';
    //       return false;
    //     }

    //     // 计算新的发送框高度
    //     newTextAreaHeight = oldTextAreaHeight + distance;

    //     // 触发
    //     that.dragMove({ direction: 'down', end: false, event, distance })
    //   }
    //   // 若鼠标向上移动
    //   else {

    //     // 发送框高度达到最小
    //     if (oldTextAreaHeight <= TextAreaWrap.MinHeight) {
    //       that.dragMove({ direction: 'up', end: true, event, distance: 0 })

    //       // 修改光标为可被向下移动
    //       rResizeLine.style.cursor = 's-resize';
    //       return false;
    //     }

    //     // that.nodes.dragBack.style.backgroundImage = 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1))'

    //     // 计算新的发送框高度
    //     newTextAreaHeight = oldTextAreaHeight - distance;

    //     // 触发
    //     that.dragMove({ direction: 'up', end: false, event, distance })

    //   }

    //   // 兼容鼠标快速拖动的情况：新的发送框高度不能超过最大值
    //   // if (newTextAreaHeight > TextAreaWrap.MaxHeight) {
    //   //   newTextAreaHeight = TextAreaWrap.MaxHeight;
    //   // }

    //   // // 兼容鼠标快速拖动的情况：新的发送框高度不能小于最小值
    //   // if (newTextAreaHeight < TextAreaWrap.MinHeight) {
    //   //   newTextAreaHeight = TextAreaWrap.MinHeight;
    //   // }

    //   // 修改发送框高度
    //   rTextareaWrap.style.maxHeight = newTextAreaHeight + 'px';
    //   // 修改光标为可移动
    //   rResizeLine.style.cursor = 'ns-resize';

    //   // 更新鼠标最后移动的位置（Y轴）
    //   that.dragState.endMouseTop = event.clientY;
    // }
    // function handleMouseUp(event) {
    //   that.dragMove({ direction: '', end: true, event });
    //   // 移除鼠标移动事件
    //   document.removeEventListener('mousemove', handleMouseMove);
    //   // 移除鼠标放开事件
    //   document.removeEventListener('mouseup', handleMouseUp);
    //   // 允许用户选择网页中文字
    //   document.onselectstart = null;
    //   // 允许用户拖动元素
    //   document.ondragstart = null;
    // }
    wrapper.appendChild(outside_container);
    inside.addEventListener("paste", (event) => this.insideInput(event, 'paste'));
    inside.addEventListener("input", (event) => this.insideInput(event, 'input'));
    inside.addEventListener("keydown", (event) => this.insideInput(event, 'keydown'));
    inside.addEventListener('compositionstart', (event) => this.handlerComposition(event, 'input'));
    inside.addEventListener('compositionend', (event) => this.handlerComposition(event, 'input'))
    wrapper.addEventListener('mouseenter', (event) => this.wrapperMouseEnter(event))
    wrapper.addEventListener('mouseleave', (event) => this.wrapperMouseLeave(event))

    this.nodes.div = inside;
    console.log('line', this.displayLineNumber)
    this.displayLineNumber && this.createLine();
    // this.data.word_wrap && this.setLineNumbers(this.data.code);
    this.displayLineNumber && this.data.word_wrap && this.setLineNumbersHeight(this.data.code);

    this.checkWrap();

    console.log(wrapper, 'WRAPPER')


    return wrapper;
  }

  renderSettings() {

    const wrapper = this.make('div', 'ce-popover-item-wrapper'),
      lineNumberItem = this.make('div', 'ce-popover-item'),
      label = this.make('div', 'ce-popover-item-label'),
      icon = this.make('div', 'ce-popover-item-icon'),
      preWrapper = this.make('div', 'ce-popover-item'),
      preIcon = this.make('div', 'ce-popover-item-icon'),
      preText = this.make('div', 'ce-popover-item-label'),
      pre_input = this.make('input', 'code-plus-pre-input');

    const text = document.createTextNode('Line Number');
    icon.innerHTML = IconStar;
    label.appendChild(text);

    lineNumberItem.appendChild(icon);
    lineNumberItem.appendChild(label);

    preIcon.innerHTML = IconEtcHorisontal;
    preText.textContent = 'word wrap';
    pre_input.setAttribute('type', 'checkbox');
    this.data.word_wrap && pre_input.setAttribute('checked', this.data.word_wrap);
    preWrapper.appendChild(preIcon);
    preWrapper.appendChild(preText);
    preWrapper.appendChild(pre_input);
    preWrapper.addEventListener('click', (event) => {
      pre_input.checked = !this.data.word_wrap;
      this.data.word_wrap = pre_input.checked;
      this.checkWrap();
      this.setLineNumbers(this.nodes.div.textContent);
      this.setLineNumbersHeight();
      event.stopPropagation();
    });

    pre_input.addEventListener('click', (event) => {
      pre_input.checked = !this.data.word_wrap;
      this.data.word_wrap = pre_input.checked;
      this.checkWrap();
      this.setLineNumbers(this.nodes.div.textContent);
      this.setLineNumbersHeight();
      event.stopPropagation();
    })

    wrapper.appendChild(lineNumberItem);
    wrapper.appendChild(preWrapper);

    lineNumberItem.addEventListener('click', () => {
      this.displayLineNumber = !this.displayLineNumber;

      if (this.displayLineNumber) {
        this.createLine(this.TextAreaWrap.MaxHeight);


        this.setLineNumbersHeight();
      } else {
        this.nodes.outside.style.paddingLeft = this.config.minWidth + 'px';
        this.removeLine();
      }

    })




    return wrapper;
  }

  makeLanguageMenu() {

    const SVG_NS = "http://www.w3.org/2000/svg";

    const codePlusLibraryMenu = this.make('div', ['code-plus-library-menu', this.CSS.language]),
      selectLangueMenu = this.make('div', 'code-plus-select-language-menu'),
      codeTitle = this.make('input', 'code-plus-title'),
      languageMenu = this.make('div', 'code-plus-language-menu'),
      languageItem = this.make('div', ['code-plus-language-item', this.readOnly ? '' : 'is-hover']),
      languageText = this.make('span'),
      languageOutside = this.make('div', 'code-plus-language-outside'),
      languageOptions = this.make('div', 'code-plus-language-options'),
      languageOptionScroll = this.make('div', 'code-plus-language-scroll'),
      languageOptionContainer = this.make('div'),
      copy = this.make('div', 'code-plus-copy'),
      copyInfo = this.make('div', ['code-plus-copy-info', 'hidden']),
      svg = this.make('span'),
      input = this.make('input', ['code-plus-input']),

      svgWrapper = this.make('div', [this.CSS.svgWrapper]);

    svgWrapper.innerHTML = copysvg;

    input.value = '';
    input.placeholder = '搜索语言';

    this.nodes.input = input;

    let type = 'mouse'
    copy.addEventListener('mouseenter', (ev) => {
      if (copyInfo.classList.contains('hidden') && type === 'mouse') {
        copyInfo.classList.remove('hidden');
        copyInfo.classList.add('visible');
      }
    })

    copy.addEventListener('mouseleave', () => {
      if (copyInfo.classList.contains('visible')) {
        copyInfo.classList.remove('visible');
        copyInfo.classList.add('hidden')
      }

      type = 'mouse';
    })


    copyInfo.textContent = '拷贝'
    languageOptions.appendChild(input);

    let arr = []
    input.addEventListener('input', (event) => {
      if (event.target.value) {
        arr = this.languages.filter(item => {
          var reg = new RegExp(event.target.value, "gi");
          return item.match(reg)
        })
      } else {
        arr = this.languages;
      }


      const fragment = document.createDocumentFragment();
      for (const language of arr) {
        const el = this.make('div', 'code-plus-language-option');
        el.textContent = language;
        fragment.appendChild(el)
      }

      while (languageOptionContainer.firstChild) {
        languageOptionContainer.removeChild(languageOptionContainer.firstChild);
      }

      languageOptionContainer.appendChild(fragment)

    })
    this.nodes.languageOptionContainer = languageOptionContainer;
    languageOptionScroll.appendChild(languageOptionContainer);
    languageOptions.appendChild(languageOptionScroll);
    languageOutside.appendChild(languageOptions)
    this.nodes.languageOutside = languageOutside;
    this.nodes.languageOptions = languageOptions;
    languageOutside.addEventListener('click', (event) => {
      if (languageOptions.contains(event.target)) return;
      if (document.body.contains(languageOutside)) {
        document.body.removeChild(languageOutside);
      }
    })




    languageText.textContent = this.data.language;
    this.nodes.languageText = languageText;
    languageItem.appendChild(languageText);
    svg.innerHTML = select;

    if (!this.readOnly) {
      languageItem.appendChild(svg);
    }

    const fragment = document.createDocumentFragment();

    for (const language of this.languages) {
      const el = this.make('div', 'code-plus-language-option');
      el.textContent = language;
      fragment.appendChild(el)
    }

    languageOptionContainer.appendChild(fragment);
    languageOptionContainer.addEventListener('click', (event) => {
      const text = event.target.textContent;

      if (text && text !== '纯文本') {
        const html = this.replaceSuperFluous(this.generateHtml(text));
        this.nodes.languageText.textContent = text;
        this.nodes.div.innerHTML = html;
      } else {
        this.nodes.languageText.textContent = text;
        this.nodes.div.textContent = this.nodes.div.textContent;
      }

      this.data.language = text;

      if (document.body.contains(this.nodes.languageOutside)) {
        document.body.removeChild(this.nodes.languageOutside);
      }
      this.block.dispatchChange();

      event.preventDefault();
      event.stopPropagation();
    })

    codeTitle.placeholder = '请输入代码名称';
    codeTitle.spellcheck = false;
    codeTitle.value = this.data.title || '';
    if (this.readOnly) {
      codeTitle.setAttribute('readonly', true)
    }
    codeTitle.addEventListener('keydown', (event) => {
      // 判断是否按下了回车键
      if (event.key === 'Enter') {
        this.data.title = event.target.value;
        event.target.blur();
        this.block.dispatchChange();
      }
    });

    selectLangueMenu.appendChild(codeTitle);



    languageMenu.appendChild(languageItem);
    languageMenu.addEventListener('click', (event) => this.languageMenuClick(event))

    selectLangueMenu.appendChild(languageMenu);

    copy.appendChild(svgWrapper);


    selectLangueMenu.appendChild(copy);
    selectLangueMenu.appendChild(copyInfo)

    let bool = true;
    copy.addEventListener("click", () => {

      if (bool) {
        bool = false;
        type = 'click';

        var oInput = document.createElement('input');
        oInput.value = this.nodes.div.textContent;
        document.body.appendChild(oInput);
        oInput.select();
        document.execCommand("Copy");
        oInput.className = 'oInput';
        oInput.style.display = 'none';
        document.body.removeChild(oInput);



        svgWrapper.innerHTML = successcopy;
        copyInfo.textContent = '拷贝成功';

        if (copyInfo.classList.contains('hidden') && type === 'click') {
          copyInfo.classList.remove('hidden');
          copyInfo.classList.add('visible');
        }


        var timer = setTimeout(() => {
          if (copyInfo.classList.contains('visible')) {
            copyInfo.classList.remove('visible');
            copyInfo.classList.add('hidden');
            clearTimeout(timer);
          }

          svgWrapper.innerHTML = copysvg;
          bool = true;

        }, 1000)
      }

    })

    copyInfo.addEventListener('transitionend', (ev) => {
      if (ev.target.classList.contains('hidden')) {
        copyInfo.textContent = '拷贝';
      }
    })

    codePlusLibraryMenu.appendChild(selectLangueMenu);

    this.nodes.codePlusLibraryMenu = codePlusLibraryMenu;
    this.nodes.languageMenu = selectLangueMenu;

    this.nodes.languageItem_svg = svg;
    this.nodes.copy = copy;



    return codePlusLibraryMenu;

  }

  make(tagName, classNames = null, attributes = {}) {
    let el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (let attrName in attributes) {
      el[attrName] = attributes[attrName];
    }

    return el;
  }

  makeSvg(tagName, d, width, height, viewBox, fill, className = null) {
    let el = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("clip-rule", "evenodd");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", viewBox);
    if (className) {
      svg.classList.add(className);
    }

    return el

  }
  /**
   * Return Tool's view
   *
   * @returns {HTMLDivElement} this.nodes.holder - Code's wrapper
   * @public
   */
  render() {
    console.log(this.nodes.holder, 'this.nodes.holder')
    return this.nodes.holder;
  }

  /**
   * Extract Tool's data from the view
   *
   * @param {HTMLDivElement} codeWrapper - CodeTool's wrapper, containing div with code
   * @returns {CodeData} - saved plugin code
   * @public
   */
  save(codeWrapper) {
    return {
      code: codeWrapper.querySelector('.code-plus__inside').textContent,
      language: codeWrapper.querySelector('.code-plus-language-item').textContent,
      lineNumber: Math.floor(codeWrapper.querySelector('.cdx-input').clientHeight),
      width: codeWrapper.querySelector('.code-plus-line-number-es').clientWidth,
      contentHeight: codeWrapper.querySelector('.code-plus__outside').clientHeight,
      title: codeWrapper.querySelector('.code-plus-title').value,
      word_wrap: this.data.word_wrap,
      lineHeights: this.data.lineHeights,
      unfold: this.data.unfold,
    };
  }

  /**
   * Returns Tool`s data from private property
   *
   * @returns {CodeData}
   */
  get data() {
    return this._data;
  }

  /**
   * Set Tool`s data to private property and update view
   *
   * @param {CodeData} data - saved tool data
   */
  set data(data) {
    this._data = data;

    if (this.nodes.div) {
      this.nodes.div.textContent = data.code;
    }
  }

  /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   *
   * @returns {{icon: string, title: string}}
   */
  static get toolbox() {
    return {
      icon: IconBrackets,
      title: 'Code',
    };
  }

  /**
   * Default placeholder for CodeTool's div
   *
   * @public
   * @returns {string}
   */
  static get DEFAULT_PLACEHOLDER() {
    return 'Enter a code';
  }

  /**
   *  Used by Editor.js paste handling API.
   *  Provides configuration to handle CODE tag.
   *
   * @static
   * @returns {{tags: string[]}}
   */
  static get pasteConfig() {
    return {
      tags: ['pre'],
    };
  }

  /**
   * Automatic sanitize config
   *
   * @returns {{code: boolean}}
   */
  static get sanitize() {
    return {
      code: true, // Allow HTML tags
    };
  }
  /**
  * 复制粘贴处理
  * @param e
  */
  textInit(event, value) {
    const selection = this.selection;
    const range = this.range;
    if (!selection.rangeCount) return false
    selection.getRangeAt(0).insertNode(document.createTextNode(value));
    this.nodes.div.normalize();
    var rangeStartOffset = range.startOffset;
    this.positioningHandle(selection, range, this.nodes.div.childNodes[0], rangeStartOffset + value.length);
    event.preventDefault();
    event.stopPropagation();
  }



  pasteHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    let paste = (event.clipboardData || window.clipboardData).getData('text');
    this.textInit(event, paste)
  }

  /**
   * 获取光标的位置
   */
  cursorHandler() {
    this.selection = window.getSelection();
    this.range = this.selection.getRangeAt(0);
  }

  positioningHandle(selection, range, dom, len) {
    if (len === 0) {
      len = range.startOffset;
    }
    range.setStart(dom, len);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    this.range = range;
    this.selection = selection;
  }

  // keyPressHandler(event) {
  //   event.preventDefault();
  //   this.textInit(event, this.isEnterPress ? '\n' : '\n\n');
  //   this.isEnterPress = true;
  // }

  replaceSuperFluous(code) {
    return code.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, function (match, group) {
      return group;
    }).replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, function (match, group) {
      return group;
    })
  }


  generateHtml(text) {
    return this.highlighter.codeToHtml(this.nodes.div ? this.nodes.div.textContent : this.data.code, {
      lang: text.toLocaleLowerCase(),
      theme: "github-light"
    })
  }

  handlerComposition(event, type) {
    this.isInput = !event.isTrusted;
    if (this.isInput && event.data) {
      this.insideInput(event, type);
    }
  }

  insideInput(event, type) {
    event.stopPropagation();
    if (!this.isInput) return
    const endContainer = selection.getEndContainer();
    let inset = ''
    if (type === 'keydown' && event.keyCode !== 9) {
      return
    }

    if (type === 'paste') {
      event.preventDefault();
      event.stopPropagation();
      const clipboard = event.clipboardData || window.clipboardData
      if (clipboard) {
        selection.deleteContents()
        inset = clipboard.getData("text/plain").toString().replace(/\r\n/g, '\n')
      } else {
        alert('Paste is not supported, please enter it manually!')
        return
      }
    }

    getFrontOffset(this.nodes.div, endContainer, inset, (totalOffset, textContext) => {
      console.log('textContent', JSON.stringify(textContext))
      if (this.nodes.languageText.textContent === '纯文本') {
        this.nodes.div.textContent = textContext;
      } else {
        const realContent = this.replaceSuperFluous(this.highlighter.codeToHtml(textContext, {
          lang: this.data.language.toLocaleLowerCase(),
          theme: "github-light"
        }))

        this.nodes.div.innerHTML = realContent;

      }
      getRealDomAndOffset(this.nodes.div, totalOffset, (el, i) => {
        selection.setCursorOffset(el, i)
      })
    })

    console.log(this.data.unfold, this.nodes.outside.clientHeight, this.nodes.div.clientHeight)
    // 没展开,
    if (!this.data.unfold) {
      // 代码的高度要比外边高度高,说明有多余的代码
      if (this.nodes.outside.clientHeight < this.nodes.div.clientHeight) {
        this.addMask();
      }

      // 反之,外面的高度和代码高度一样,说明没有多余的代码了
      if (this.nodes.outside.clientHeight >= this.nodes.div.clientHeight) {
        this.removeMask();
      }
    }

    // 如果已经展开了,眼影就不需要了
    if (this.data.unfold) {
      this.removeMask()
    }

    this.TextAreaWrap.MaxHeight = this.nodes.div.clientHeight;

    // 看是不是要去掉拖拽条
    // 如果 代码的高度大于440px,就必须要有
    if (this.TextAreaWrap.MaxHeight > 440) {
      this.addDragBack()
    }

    if (this.TextAreaWrap.MaxHeight <= 440) {
      this.removeDragBack();
    }

    this.createLine(this.TextAreaWrap.MaxHeight);
    this.setLineNumbers(this.nodes.div.textContent);
    this.setLineNumbersHeight();
    this.createLine()
  }

  languageMenuClick(event) {
    if (this.readOnly) return
    const { bottom, left } = event.target.getBoundingClientRect();
    if (!document.body.contains(this.nodes.languageOutside)) {
      document.body.appendChild(this.nodes.languageOutside);
    }
    this.nodes.languageOptions.style.top = `${(bottom)}px`;
    this.nodes.languageOptions.style.left = `${left}px`;

    this.nodes.input.focus();
    // 重置数据
    this.nodes.input.value = '';
    const fragment = document.createDocumentFragment();
    for (const language of this.languages) {
      const el = this.make('div', 'code-plus-language-option');
      el.textContent = language;
      fragment.appendChild(el)
    }

    while (this.nodes.languageOptionContainer.firstChild) {
      this.nodes.languageOptionContainer.removeChild(this.nodes.languageOptionContainer.firstChild);
    }

    this.nodes.languageOptionContainer.appendChild(fragment)
  }
  wrapperMouseEnter(event) {
    // event.preventDefault();
    // event.stopPropagation()
    // if ((this.nodes.copy.style.opacity === '' || this.nodes.copy.style.opacity === '0')) {
    //   this.nodes.copy.style.opacity = '1';
    //   this.nodes.languageItem_svg.style.opacity = '1'
    // }
  }
  wrapperMouseLeave(event) {
    // event.preventDefault();
    // event.stopPropagation()
    // if ((this.nodes.copy.style.opacity === '1' && !document.body.contains(this.nodes.languageOutside))) {
    //   this.nodes.copy.style.opacity = '0';
    //   this.nodes.languageItem_svg.style.opacity = '0'
    // }
  }

  createLine(height = 0) {
    const nodeLen = this.nodes.lineNumbers.childNodes.length;
    const vnodeLen = height !== 0 ? Math.ceil(this.TextAreaWrap.MaxHeight / 22) : this.data.lineHeights.length;
    // 分情况
    // 如果nodelen大于vnodelen了,说明是删除
    if (nodeLen > vnodeLen) {
      let number = nodeLen - vnodeLen;
      while (number > 0) {
        this.nodes.lineNumbers.removeChild(this.nodes.lineNumbers.lastChild);
        number--;
      }
    }

    // 如果vnodelen大于nodelen.说明是增加
    if (vnodeLen > nodeLen) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < (vnodeLen - nodeLen); index++) {
        const span = document.createElement('span');
        span.textContent = (nodeLen + index + 1);
        fragment.appendChild(span);
      }
      this.nodes.lineNumbers.appendChild(fragment);
    }

    // 如果还没开始,都为0的情况,默认展示第一行
    if (vnodeLen === 0 && nodeLen === 0) {
      const span = document.createElement('span');
      span.textContent = '1';
      this.nodes.lineNumbers.appendChild(span);
    }

    if (this.nodes.outside) {
      const width = this.nodes.lineNumbers.clientWidth || this.data.minWidth;
      this.nodes.outside.style.paddingLeft = width + 'px';
    }

  }

  removeLine() {
    const lineDom = this.nodes.lineNumbers;
    while (lineDom.lastChild) {
      lineDom.removeChild(lineDom.lastChild);
    }
  }

  checkWrap() {
    if (this.data.word_wrap) {
      this.nodes.div.style.whiteSpace = 'pre-wrap';
      this.nodes.div.style.wordBreak = 'break-all';
    } else {
      this.nodes.div.style.whiteSpace = 'pre';
      this.nodes.div.style.wordBreak = 'break-all';
    }
  }

  setLineNumbers(textContext) {

    textContext ? textContext : this.nodes.div.textContent;
    var NEW_LINE_EXP = /\n(?!$)/g;

    var codeLines = textContext.split(NEW_LINE_EXP);
    var lineHeights = [];
    var oneLinerHeight = 22;
    var lineNumberSizer = this.nodes.lineNumberSizer;

    if (!this.nodes.div.contains(lineNumberSizer)) {
      this.nodes.div.appendChild(lineNumberSizer);
    }

    lineHeights[codeLines.length - 1] = undefined;

    codeLines.forEach((line, index) => {
      if (line && line.length > 1) {
        var e = lineNumberSizer.appendChild(document.createElement('span'));
        e.style.display = 'block';
        e.textContent = line
      } else {
        lineHeights[index] = oneLinerHeight;
      }
    })

    var childIndex = 0;
    for (var i = 0; i < lineHeights.length; i++) {
      if (lineHeights[i] === undefined) {
        lineHeights[i] = lineNumberSizer.children[childIndex++].getBoundingClientRect().height;
      }
    }

    lineNumberSizer.innerHTML = '';

    this.nodes.div.removeChild(lineNumberSizer);
    this.data.lineHeights = lineHeights;
  }

  setLineNumbersHeight() {
    console.log('linenumber', this.nodes.lineNumbers)
    this.data.lineHeights.forEach((lineHeight, index) => {
      this.nodes.lineNumbers.children[index].style.height = lineHeight + 'px';
    })
  }

  addDragBack() {
    if (!this.nodes.outside_container.contains(this.nodes.dragBack)) {
      this.nodes.outside_container.appendChild(this.nodes.dragBack);
    }
  }
  removeDragBack() {
    if (this.nodes.outside_container.contains(this.nodes.dragBack)) {
      this.nodes.outside_container.removeChild(this.nodes.dragBack);
    }
  }
  addMask() {
    if (!this.nodes.outside.classList.contains('mask')) {
      this.nodes.outside.classList.add('mask');
    }
  }

  removeMask() {
    if (this.nodes.outside.classList.contains('mask')) {
      this.nodes.outside.classList.remove('mask');
    }
  }
}
