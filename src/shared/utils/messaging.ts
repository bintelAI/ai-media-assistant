import type { Message, MessageResponse, MessageType } from '../types/messages';

export async function sendMessage<T = unknown, R = unknown>(
  type: MessageType,
  data?: T
): Promise<MessageResponse<R>> {
  try {
    const response = await chrome.runtime.sendMessage<Message<T>, MessageResponse<R>>({
      type,
      data
    });
    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendMessageToTab<T = unknown, R = unknown>(
  tabId: number,
  type: MessageType,
  data?: T
): Promise<MessageResponse<R>> {
  try {
    const response = await chrome.tabs.sendMessage<Message<T>, MessageResponse<R>>(tabId, {
      type,
      data
    });
    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function onMessage<T = unknown, R = unknown>(
  type: MessageType,
  handler: (data: T) => Promise<R> | R
): () => void {
  const listener = (
    message: Message<T>,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<R>) => void
  ) => {
    if (message.type !== type) return;

    Promise.resolve(handler(message.data as T))
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

    return true;
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

export function broadcastToAllTabs<T = unknown>(
  type: MessageType,
  data?: T
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, tabs => {
      const promises = tabs
        .filter(tab => tab.id)
        .map(tab => sendMessageToTab(tab.id!, type, data));
      
      Promise.all(promises)
        .then(() => resolve())
        .catch(reject);
    });
  });
}
