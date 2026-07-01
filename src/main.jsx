import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// StrictMode 는 dev 에서 effect 를 두 번 실행해 ROS 연결이 중복될 수 있어
// 데모에서는 끕니다. 실제 운영 코드에서는 켜도 무방합니다.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
