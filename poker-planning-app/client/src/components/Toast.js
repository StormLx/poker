import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({message, type, onClose, id}) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 5000); // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer);
        };
    }, [onClose, id]);

    return (
        <div className={`toast toast-${type}`}>
            <span className="toast-message">{message}</span>
            <button className="toast-close-btn" onClick={() => onClose(id)}>
                &times;
            </button>
        </div>
    );
};

export const ToastContainer = ({toasts, removeToast}) => {
    if (!toasts || toasts.length === 0) {
        return null;
    }
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={removeToast}
                />
            ))}
        </div>
    );
};

export default Toast;
