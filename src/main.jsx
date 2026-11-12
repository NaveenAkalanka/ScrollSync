import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// The toolbar popup's window is square and can't be reshaped, so the UI sits on a rounded
// pad inside it. Inside the on-page panel (an iframe that already has rounded corners) the
// pad is dropped so there is no frame within a frame.
document.documentElement.dataset.frame = window.self === window.top ? 'pad' : 'flat';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
