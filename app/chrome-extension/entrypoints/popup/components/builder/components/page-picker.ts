type PickerResponse = {
  success?: boolean;
  cancelled?: boolean;
  error?: string;
  candidates?: unknown[];
};

async function getPageTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({});
  const isPage = (tab: chrome.tabs.Tab) => /^https?:/i.test(tab.url || '');
  const tab = tabs.find((item) => item.active && isPage(item)) || tabs.find(isPage);
  if (!tab?.id) throw new Error('Open a regular web page tab first.');
  return tab;
}

async function ensureHelper(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['inject-scripts/accessibility-tree-helper.js'],
    world: 'ISOLATED',
  } as any);
}

export async function pickElementFromPage(): Promise<PickerResponse> {
  const tab = await getPageTab();
  await ensureHelper(tab.id!);
  const response = (await chrome.tabs.sendMessage(tab.id!, {
    action: 'rr_picker_start',
  } as any)) as PickerResponse;
  if (!response?.success && !response?.cancelled)
    throw new Error(response?.error || 'Pick failed.');
  return response;
}

export async function validatePageSelector(selector: string, type: string = 'css'): Promise<void> {
  if (!selector.trim()) throw new Error('Fill in a selector first.');
  if (!['css', 'attr', 'xpath'].includes(type))
    throw new Error('Use CSS, Attr, or XPath locators.');
  const tab = await getPageTab();
  await ensureHelper(tab.id!);
  const response: any = await chrome.tabs.sendMessage(tab.id!, {
    action: 'ensureRefForSelector',
    selector,
    isXPath: type === 'xpath',
    highlight: true,
  } as any);
  if (!response?.success) throw new Error(response?.error || 'Element not located.');
}
