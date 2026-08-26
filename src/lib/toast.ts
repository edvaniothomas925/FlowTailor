type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmDialogData {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function toast(message: string, type: ToastType = 'success') {
  const event = new CustomEvent<{ message: string; type: ToastType }>('app-toast', {
    detail: { message, type }
  });
  window.dispatchEvent(event);
}

toast.success = (msg: string) => toast(msg, 'success');
toast.error = (msg: string) => toast(msg, 'error');
toast.info = (msg: string) => toast(msg, 'info');
toast.warn = (msg: string) => toast(msg, 'warning');

export function confirmDialog(message: string, onConfirm: () => void, onCancel?: () => void) {
  const event = new CustomEvent<ConfirmDialogData>('app-confirm', {
    detail: { message, onConfirm, onCancel }
  });
  window.dispatchEvent(event);
}
