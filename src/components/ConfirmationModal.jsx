import React from 'react';
import '../App.css'; // Re-use global modal styles if possible, or define new ones

const ConfirmationModal = ({ isOpen, onClose, onConfirm, message, title = "Confirm Action" }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content confirmation-modal">
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
                    <button className="modal-btn confirm" onClick={onConfirm}>Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
