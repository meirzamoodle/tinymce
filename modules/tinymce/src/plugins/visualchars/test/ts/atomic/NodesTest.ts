import { Assertions } from '@ephox/agar';
import { context, describe, it } from '@ephox/bedrock-client';
import { Arr, Unicode } from '@ephox/katamari';
import { Html, SugarElement, SugarNode } from '@ephox/sugar';
import { assert } from 'chai';

import * as Nodes from 'tinymce/plugins/visualchars/core/Nodes';

describe('atomic.tinymce.plugins.visualchars.NodesTest', () => {
  context('replaceWithSpans', () => {
    it('replace with spans', () => {
      Assertions.assertHtml(
        'should return span around shy and nbsp',
        'a<span data-mce-bogus="1" class="mce-nbsp">\u00a0</span>b<span data-mce-bogus="1" class="mce-shy">\u00AD</span>',
        Nodes.replaceWithSpans('a' + Unicode.nbsp + 'b' + Unicode.softHyphen)
      );
    });
  });

  context('filterDescendants', () => {
    it('should return list with nodes with shy or nbsp in it', () => {
      const div = document.createElement('div');

      // 2 matches
      div.innerHTML = (
        '<p>a</p>' +
        '<p>b' + Unicode.nbsp + '</p>' +
        '<p>c</p>' +
        '<p>d' + Unicode.softHyphen + '</p>'
      );
      assert.equal(Nodes.filterEditableDescendants(SugarElement.fromDom(div), Nodes.isMatch, true).length, 2);

      // 4 matches
      div.innerHTML = (
        '<p>a' + Unicode.nbsp + '</p>' +
        '<p>b' + Unicode.nbsp + '</p>' +
        '<p>c' + Unicode.nbsp + '</p>' +
        '<p>d' + Unicode.softHyphen + '</p>'
      );
      assert.equal(Nodes.filterEditableDescendants(SugarElement.fromDom(div), Nodes.isMatch, true).length, 4);
    });

    it('should only return editable nodes for initial editable state', () => {
      const innerHtml = `
        <b>editable 1</b>
        <span contenteditable="false">
          <b><i>noneditable</i></b>
          <span contenteditable="true">
            <b>editable 2</b>
            <i>editable 3</i>
          </span>
          <i>noneditable</i>
          <span contenteditable="true">
            <b>editable 4</b>
          </span>
        </span>
        <i>editable 5</i>
      `;
      const div = SugarElement.fromHtml(`<div>${innerHtml}</div>`);

      assert.deepEqual(Arr.map(Nodes.filterEditableDescendants(div, SugarNode.isElement, true), Html.getOuter), [
        '<b>editable 1</b>',
        '<b>editable 2</b>',
        '<i>editable 3</i>',
        '<b>editable 4</b>',
        '<i>editable 5</i>'
      ]);
    });

    it('should only return editable nodes for initial noneditable state', () => {
      const innerHtml = `
        <b>noneditable</b>
        <span contenteditable="false">
          <b><i>noneditable</i></b>
          <span contenteditable="true">
            <b>editable 1</b>
            <i>editable 2</i>
          </span>
          <i>noneditable</i>
          <span contenteditable="true">
            <b>editable 3</b>
          </span>
        </span>
        <i>noneditable</i>
      `;
      const div = SugarElement.fromHtml(`<div>${innerHtml}</div>`);

      assert.deepEqual(Arr.map(Nodes.filterEditableDescendants(div, SugarNode.isElement, false), Html.getOuter), [
        '<b>editable 1</b>',
        '<i>editable 2</i>',
        '<b>editable 3</b>'
      ]);
    });
  });
});
