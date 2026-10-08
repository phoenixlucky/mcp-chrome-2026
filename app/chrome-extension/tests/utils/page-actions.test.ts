import { beforeAll, describe, expect, it } from 'vitest';
import { CONTEXT_ACTION_MESSAGE_TYPES } from '@/common/message-types';
import { handlePageAction } from '@/utils/page-actions';

beforeAll(() => {
  // jsdom returns zero-size rects; give every element a visible box.
  Element.prototype.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      width: 100,
      height: 50,
    } as DOMRect;
  };
});

describe('page actions', () => {
  it('reports an unknown action', async () => {
    const result = await handlePageAction('nope');
    expect(result).toEqual({ success: false, error: 'Unknown page action' });
  });

  it('fills empty English-typed fields with English test data', async () => {
    document.body.innerHTML = `
      <input id="email" type="email" />
      <input id="name" name="userName" />
      <div contenteditable="true"></div>
    `;
    const result = await handlePageAction(CONTEXT_ACTION_MESSAGE_TYPES.FILL_EMPTY_TEST_DATA);
    expect(result.success).toBe(true);
    expect((document.getElementById('email') as HTMLInputElement).value).toBe(
      'test.user@example.com',
    );
    expect((document.querySelector('input#name') as HTMLInputElement).value).toBe('Test User');
    expect(document.querySelector('[contenteditable="true"]')!.textContent).toBe('Test Content');
  });

  it('closes an English cookie banner via its close button', async () => {
    document.body.innerHTML = `
      <div id="banner" role="dialog" style="position:fixed;top:0;left:0;width:200px;height:100px">
        We use cookies for consent and privacy.
        <button id="close" style="width:60px;height:20px">Accept</button>
      </div>
    `;
    let clicked = false;
    document.getElementById('close')!.addEventListener('click', () => (clicked = true));
    const result = await handlePageAction(CONTEXT_ACTION_MESSAGE_TYPES.SMART_CLOSE_POPUPS);
    expect(result.count).toBe(1);
    expect(clicked).toBe(true);
  });
});
