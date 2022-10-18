import { log } from '../../logger';
import { generateId } from '../../utils';
import mermaidAPI from '../../mermaidAPI';
import common from '../common/common';
import * as configApi from '../../config';
import {
  setAccTitle,
  getAccTitle,
  getAccDescription,
  setAccDescription,
  clear as commonClear,
} from '../../commonDb';
import utils from '../../utils';

const sanitizeText = (txt) => common.sanitizeText(txt, configApi.getConfig());

const clone = (o) => JSON.parse(JSON.stringify(o));
let rootDoc = [];

export const parseDirective = function (statement, context, type) {
  mermaidAPI.parseDirective(this, statement, context, type);
};

const setRootDoc = (o) => {
  log.info('Setting root doc', o);
  // rootDoc = { id: 'root', doc: o };
  rootDoc = o;
};

const getRootDoc = () => rootDoc;

const docTranslator = (parent, node, first) => {
  if (node.stmt === 'relation') {
    docTranslator(parent, node.state1, true);
    docTranslator(parent, node.state2, false);
  } else {
    if (node.stmt === 'state') {
      if (node.id === '[*]') {
        node.id = first ? parent.id + '_start' : parent.id + '_end';
        node.start = first;
      }
    }

    if (node.doc) {
      const doc = [];
      // Check for concurrency
      let i = 0;
      let currentDoc = [];
      for (i = 0; i < node.doc.length; i++) {
        if (node.doc[i].type === 'divider') {
          // debugger;
          const newNode = clone(node.doc[i]);
          newNode.doc = clone(currentDoc);
          doc.push(newNode);
          currentDoc = [];
        } else {
          currentDoc.push(node.doc[i]);
        }
      }

      // If any divider was encountered
      if (doc.length > 0 && currentDoc.length > 0) {
        const newNode = {
          stmt: 'state',
          id: generateId(),
          type: 'divider',
          doc: clone(currentDoc),
        };
        doc.push(clone(newNode));
        node.doc = doc;
      }

      node.doc.forEach((docNode) => docTranslator(node, docNode, true));
    }
  }
};
const getRootDocV2 = () => {
  docTranslator({ id: 'root' }, { id: 'root', doc: rootDoc }, true);
  return { id: 'root', doc: rootDoc };
  // Here
};

const extract = (_doc) => {
  // const res = { states: [], relations: [] };
  let doc;
  if (_doc.doc) {
    doc = _doc.doc;
  } else {
    doc = _doc;
  }
  // let doc = root.doc;
  // if (!doc) {
  //   doc = root;
  // }
  log.info(doc);
  clear(true);

  log.info('Extract', doc);

  doc.forEach((item) => {
    if (item.stmt === 'state') {
      addState(item.id, item.type, item.doc, item.description, item.note);
    }
    if (item.stmt === 'relation') {
      addRelation(item.state1.id, item.state2.id, item.description);
    }
  });
};

const newDoc = () => {
  return {
    relations: [],
    states: {},
    documents: {},
  };
};

let documents = {
  root: newDoc(),
};

let currentDocument = documents.root;

let startCnt = 0;

/**
 * Function called by parser when a node definition has been found.
 *
 * @param {any} id
 * @param {any} type
 * @param {any} doc
 * @param {any} descr
 * @param {any} note
 */
export const addState = function (id, type, doc, descr, note) {
  if (typeof currentDocument.states[id] === 'undefined') {
    currentDocument.states[id] = {
      id: id,
      descriptions: [],
      type,
      doc,
      note,
    };
  } else {
    if (!currentDocument.states[id].doc) {
      currentDocument.states[id].doc = doc;
    }
    if (!currentDocument.states[id].type) {
      currentDocument.states[id].type = type;
    }
  }
  if (descr) {
    log.info('Adding state ', id, descr);
    if (typeof descr === 'string') addDescription(id, descr.trim());

    if (typeof descr === 'object') {
      descr.forEach((des) => addDescription(id, des.trim()));
    }
  }

  if (note) {
    currentDocument.states[id].note = note;
    currentDocument.states[id].note.text = common.sanitizeText(
      currentDocument.states[id].note.text,
      configApi.getConfig()
    );
  }
};

export const clear = function (saveCommon) {
  documents = {
    root: newDoc(),
  };
  currentDocument = documents.root;

  currentDocument = documents.root;

  startCnt = 0;
  classes = [];
  if (!saveCommon) {
    commonClear();
  }
};

export const getState = function (id) {
  return currentDocument.states[id];
};

export const getStates = function () {
  return currentDocument.states;
};
export const logDocuments = function () {
  log.info('Documents = ', documents);
};
export const getRelations = function () {
  return currentDocument.relations;
};

export const addRelation = function (_id1, _id2, title) {
  let id1 = _id1;
  let id2 = _id2;
  let type1 = 'default';
  let type2 = 'default';
  if (_id1 === '[*]') {
    startCnt++;
    id1 = 'start' + startCnt;
    type1 = 'start';
  }
  if (_id2 === '[*]') {
    id2 = 'end' + startCnt;
    type2 = 'end';
  }
  addState(id1, type1);
  addState(id2, type2);
  currentDocument.relations.push({
    id1,
    id2,
    title: common.sanitizeText(title, configApi.getConfig()),
  });
};

const addDescription = function (id, _descr) {
  const theState = currentDocument.states[id];
  let descr = _descr;
  if (descr[0] === ':') {
    descr = descr.substr(1).trim();
  }
  theState.descriptions.push(common.sanitizeText(descr, configApi.getConfig()));
};

export const cleanupLabel = function (label) {
  if (label.substring(0, 1) === ':') {
    return label.substr(2).trim();
  } else {
    return label.trim();
  }
};

export const lineType = {
  LINE: 0,
  DOTTED_LINE: 1,
};

let dividerCnt = 0;
const getDividerId = () => {
  dividerCnt++;
  return 'divider-id-' + dividerCnt;
};

let classes = [];

const getClasses = () => classes;

let direction = 'TB';
const getDirection = () => direction;
const setDirection = (dir) => {
  direction = dir;
};

export const relationType = {
  AGGREGATION: 0,
  EXTENSION: 1,
  COMPOSITION: 2,
  DEPENDENCY: 3,
};

const trimColon = (str) => (str && str[0] === ':' ? str.substr(1).trim() : str.trim());

/**
 * Function to lookup domId from id in the graph definition.
 *
 * @param id
 * @public
 */
export const lookUpDomId = function (id) {
  const classKeys = Object.keys(classes);
  for (let i = 0; i < classKeys.length; i++) {
    if (classes[classKeys[i]].id === id) {
      return classes[classKeys[i]].domId;
    }
  }
};

const MERMAID_DOM_ID_PREFIX = 'stateid-';

/**
 * Called by parser when a special node is found, e.g. a clickable element.
 *
 * @param ids Comma separated list of ids
 * @param className Class to add
 */
export const setCssClass = function (ids, className) {
  ids.split(',').forEach(function (_id) {
    let id = _id;
    if (_id[0].match(/\d/)) id = MERMAID_DOM_ID_PREFIX + id;
    if (typeof classes[id] !== 'undefined') {
      classes[id].cssClasses.push(className);
    }
  });
};

/**
 * Called by parser when a click definition is found. Registers an event handler.
 *
 * @param ids Comma separated list of ids
 * @param functionName Function to be called on click
 * @param functionArgs Function args the function should be called with
 */
export const setClickEvent = function (ids, functionName, functionArgs) {
  ids.split(',').forEach(function (id) {
    setClickFunc(id, functionName, functionArgs);
    classes[id].haveCallback = true;
  });
  setCssClass(ids, 'clickable');
};

let funs = [];

export const bindFunctions = function (element) {
  funs.forEach(function (fun) {
    fun(element);
  });
};

const setClickFunc = function (domId, functionName, functionArgs) {
  const config = configApi.getConfig();
  let id = domId;
  let elemId = lookUpDomId(id);

  if (config.securityLevel !== 'loose') {
    return;
  }
  if (typeof functionName === 'undefined') {
    return;
  }
  if (typeof classes[id] !== 'undefined') {
    let argList = [];
    if (typeof functionArgs === 'string') {
      /* Splits functionArgs by ',', ignoring all ',' in double quoted strings */
      argList = functionArgs.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      for (let i = 0; i < argList.length; i++) {
        let item = argList[i].trim();
        /* Removes all double quotes at the start and end of an argument */
        /* This preserves all starting and ending whitespace inside */
        if (item.charAt(0) === '"' && item.charAt(item.length - 1) === '"') {
          item = item.substr(1, item.length - 2);
        }
        argList[i] = item;
      }
    }

    /* if no arguments passed into callback, default to passing in id */
    if (argList.length === 0) {
      argList.push(elemId);
    }

    funs.push(function () {
      const elem = document.querySelector(`[id="${elemId}"]`);
      if (elem !== null) {
        elem.addEventListener(
          'click',
          function () {
            utils.runFunc(functionName, ...argList);
          },
          false
        );
      }
    });
  }
};

/**
 * Called by parser when a link is found. Adds the URL to the vertex data.
 *
 * @param ids Comma separated list of ids
 * @param linkStr URL to create a link for
 * @param target Target of the link, _blank by default as originally defined in the svgDraw.js file
 */
export const setLink = function (ids, linkStr, target) {
  const config = configApi.getConfig();
  ids.split(',').forEach(function (_id) {
    let id = _id;
    if (_id[0].match(/\d/)) id = MERMAID_DOM_ID_PREFIX + id;
    if (typeof classes[id] !== 'undefined') {
      classes[id].link = utils.formatUrl(linkStr, config);
      if (config.securityLevel === 'sandbox') {
        classes[id].linkTarget = '_top';
      } else if (typeof target === 'string') {
        classes[id].linkTarget = sanitizeText(target);
      } else {
        classes[id].linkTarget = '_blank';
      }
    }
  });
  setCssClass(ids, 'clickable');
};

const setTooltip = function (ids, tooltip) {
  ids.split(',').forEach(function (id) {
    if (typeof tooltip !== 'undefined') {
      tooltips[version === 'gen-1' ? lookUpDomId(id) : id] = sanitizeText(tooltip);
    }
  });
};

export default {
  parseDirective,
  getConfig: () => configApi.getConfig().state,
  addState,
  bindFunctions,
  clear,
  getState,
  getStates,
  getRelations,
  getClasses,
  getDirection,
  addRelation,
  getDividerId,
  setClickEvent,
  setDirection,
  setLink,
  cleanupLabel,
  lineType,
  relationType,
  logDocuments,
  getRootDoc,
  setRootDoc,
  getRootDocV2,
  extract,
  trimColon,
  getAccTitle,
  setAccTitle,
  getAccDescription,
  setAccDescription,
};
