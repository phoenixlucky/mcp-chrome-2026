/**
 * Prepare a file path for CDP file APIs. Local paths can be used directly;
 * remote/base64 input is materialized by the native messaging host.
 */
export async function prepareFileFromRemote(options: {
  fileUrl?: string;
  base64Data?: string;
  fileName: string;
}): Promise<string | null> {
  const { fileUrl, base64Data, fileName } = options;

  return new Promise((resolve) => {
    const requestId = `file-prepare-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      resolve(null);
    }, 30_000);

    const handleMessage = (message: any) => {
      if (message?.type !== 'native_file_operation_response' || message.requestId !== requestId)
        return;

      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(handleMessage);
      resolve(message.result?.success && message.result.filePath ? message.result.filePath : null);
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    chrome.runtime
      .sendMessage({
        type: 'forward_to_native',
        request: {
          requestId,
          params: { action: 'prepareFile', fileUrl, base64Data, fileName },
        },
      })
      .catch(() => {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handleMessage);
        resolve(null);
      });
  });
}
