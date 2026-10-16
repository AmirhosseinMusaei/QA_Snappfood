import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
