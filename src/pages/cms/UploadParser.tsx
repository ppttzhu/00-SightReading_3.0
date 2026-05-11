import { useState, useRef } from 'react';
import { EngineExtractor } from '../../core/engine/Extractors';
import { useAppStore } from '../../core/store/useAppStore';

export default function UploadParser() {
  const [status, setStatus] = useState<string>('idle'); // idle, parsing, success, error
  const [message, setMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addSlices = useAppStore(state => state.addSlices);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const xmlString = e.target?.result as string;
        // 调用四维引擎进行解析
        const extractedSlices = EngineExtractor.extractAll(xmlString);
        
        // 存入全局 Store
        addSlices(extractedSlices);
        
        setStatus('success');
        setMessage(`Success! Extracted ${extractedSlices.length} slices. Check the Stage Builder.`);
      } catch (error) {
        setStatus('error');
        setMessage('Failed to parse XML file. Please check the format.');
      }
    };

    reader.onerror = () => {
      setStatus('error');
      setMessage('Error reading file.');
    };

    reader.readAsText(file);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', marginBottom: '10px' }}>MusicXML Parser</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        Upload a .musicxml or .xml file. The Smart Engine will slice it into the 4 dimensions (Notes, Symbols, Theory, Patterns).
      </p>

      <div 
        style={{ 
          border: `2px dashed ${status === 'success' ? '#34d399' : '#cbd5e1'}`, 
          padding: '60px', 
          textAlign: 'center', 
          borderRadius: '12px',
          background: status === 'success' ? '#ecfdf5' : '#f8fafc',
          transition: 'all 0.3s'
        }}
      >
        {status === 'parsing' ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚙️</div>
            <p style={{ color: '#3b82f6', fontWeight: 'bold' }}>Parsing File using Engine...</p>
          </div>
        ) : status === 'success' ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
            <p style={{ color: '#059669', fontWeight: 'bold' }}>{message}</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📄</div>
            <p style={{ color: '#4b5563', marginBottom: '20px' }}>Drag & Drop or click to upload</p>
            <input 
              type="file" 
              accept=".xml,.musicxml"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                padding: '12px 24px', 
                background: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Select File
            </button>
          </div>
        )}
        {status === 'error' && (
          <p style={{ color: '#ef4444', marginTop: '20px' }}>{message}</p>
        )}
      </div>
    </div>
  );
}
