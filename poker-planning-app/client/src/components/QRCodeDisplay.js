import React from 'react';
import QRCode from 'qrcode.react';
import './QRCodeDisplay.css'; // For styling the modal/display

const QRCodeDisplay = ({ roomLink, onClose }) => {
  if (!roomLink) return null;

  return (
    <div className="qr-code-modal-backdrop" onClick={onClose}>
      <div className="qr-code-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Scan to Join Room</h3>
        <div className="qr-code-wrapper">
          <QRCode value={roomLink} size={256} level="H" includeMargin={true} renderAs="svg" />
        </div>
        <p className="qr-room-link">{roomLink}</p>
        <button onClick={onClose} className="close-qr-btn">Close</button>
      </div>
    </div>
  );
};

export default QRCodeDisplay;
