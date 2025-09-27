import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

const WORKER_URL = 'https://gemini-api-proxy.vua94713.workers.dev';

const STYLES = {
  polaroid: { 
    name: 'Polaroid', 
    prompt: 'Transform this photo to look like it was taken with a Polaroid camera. The photo should have a slight blur effect and a strong, direct flash lighting effect, typical of indoor flash photography. Maintain the original subjects but apply this vintage, instant-camera aesthetic.' 
  },
  '3d': { 
    name: '3D Hot Trend', 
    prompt: 'Re-imagine the subject of this photo as a realistic, 1/7 scale commercialized figurine. Place the figurine on a computer desk. Next to it, show a computer screen with 3D modeling software open, displaying the process of creating the figurine. Also include a toy packaging box with the original image printed on it.'
  },
  restore: { 
    name: 'Phục chế ảnh', 
    prompt: 'Restore this old photo. Enhance sharpness, improve colors, fix any scratches or damage, and increase the overall quality, while preserving the original content and subjects.'
  },
  anime: { 
    name: 'Chân dung Anime', 
    prompt: 'Convert the person in this photo into an anime-style portrait. The style should be reminiscent of modern, high-quality anime films, with clean lines and vibrant colors.'
  },
};

const fileToGenerativePart = async (file) => {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    // FIX: Add a type guard to ensure `reader.result` is a string before calling `.split()` as its type can be `string | ArrayBuffer`.
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    mimeType: file.type,
    data: await base64EncodedDataPromise,
  };
};

const App = () => {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('polaroid');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let timer;
    if (isLoading) {
      setProgress(0);
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(timer);
            return 95;
          }
          return prev + Math.floor(Math.random() * 5) + 1;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isLoading]);
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };
  
  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleGenerate = async () => {
    if (!imageFile) {
      setError('Vui lòng tải ảnh lên trước.');
      return;
    }
    setIsLoading(true);
    setError('');
    setResultImage(null);

    try {
      const imagePart = await fileToGenerativePart(imageFile);
      const prompt = STYLES[selectedStyle].prompt;

      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePart.data,
          mimeType: imagePart.mimeType,
          prompt: prompt,
        }),
      });

      if (!response.ok) {
        let errorText = `Lỗi máy chủ: ${response.status} ${response.statusText}`;
        try {
          // Try to parse as JSON, as the worker might send a JSON error
          const errorData = await response.json();
          errorText = errorData.error || JSON.stringify(errorData);
        } catch (e) {
          // If JSON parsing fails, read as text. This can be useful for
          // Cloudflare Worker errors that return HTML or plain text.
          try {
            const textError = await response.text();
            if (textError) {
              errorText = textError;
            }
          } catch (textErr) {
            // Do nothing, just use the status text
          }
        }
        throw new Error(errorText);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (!data.image) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ, không tìm thấy dữ liệu ảnh.');
      }
      
      setProgress(100);
      setResultImage(`data:image/jpeg;base64,${data.image}`);
    } catch (err) {
      console.error(err);
      let message = 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
      if (err instanceof Error) {
        message = err.message;
      }
      // Provide a more user-friendly message for network errors
      if (message.toLowerCase().includes('failed to fetch')) {
        message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn và thử lại.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResultImage(null);
    handleRemoveImage();
    setError('');
  };
  
  if (isLoading) {
    return (
      <div className="app-container loading-container" aria-live="polite">
        <h2>Đang tạo ảnh, vui lòng chờ...</h2>
        <div className="progress-bar-container">
            <div className="progress-bar" style={{width: `${progress}%`}}></div>
        </div>
        <p className="percentage">{progress}%</p>
        <p>Quá trình này có thể mất một chút thời gian. Cảm ơn bạn đã kiên nhẫn!</p>
      </div>
    );
  }

  if (resultImage) {
    return (
        <div className="app-container result-container">
            <h1 className="header">Kết quả của bạn!</h1>
            <div className="result-image-wrapper">
                <img src={resultImage} alt="Generated result" />
            </div>
            <div className="result-actions">
                <div className="download-btn-group">
                    <a href={resultImage} download={`generated-image-${selectedStyle}.jpg`} className="generate-btn download-btn">
                        Tải Về
                    </a>
                    <a href={resultImage} download={`generated-image-${selectedStyle}.jpg`} className="icon-btn" aria-label="Download image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'white'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </a>
                </div>
                <button onClick={handleReset} className="generate-btn secondary-btn">Tạo ảnh khác</button>
            </div>
        </div>
    )
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Tạo Ảnh Trend</h1>
      </header>
      
      <div className="tabs">
        <button className="tab active">Tạo ảnh đơn</button>
        <button className="tab" disabled>Tạo hàng loạt</button>
        <button className="tab" disabled>Tạo nhiều biến thể</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}

      <section className="content-section">
        <h2>Tải ảnh lên</h2>
        <div className="image-upload-area">
          {previewUrl && (
            <div className="image-preview">
              <img src={previewUrl} alt="Image preview" />
              <button onClick={handleRemoveImage} className="remove-image-btn" aria-label="Remove image">×</button>
            </div>
          )}
          <div 
            className="upload-placeholder" 
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            role="button"
            tabIndex={0}
            aria-label="Upload an image"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <span>Ảnh</span>
            <input type="file" accept="image/png, image/jpeg" onChange={handleImageChange} ref={fileInputRef} hidden/>
          </div>
        </div>
      </section>

      <section className="content-section">
        <h2>Chọn style</h2>
        <div className="style-grid">
          {Object.entries(STYLES).map(([key, { name }]) => (
            <button 
              key={key} 
              className={`style-btn ${selectedStyle === key ? 'active' : ''}`}
              onClick={() => setSelectedStyle(key)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <button onClick={handleGenerate} className="generate-btn" disabled={!imageFile}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'white'}}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17-4.16a2 2 0 0 0-1.66 0L2 17.65"/><path d="m22 12.65-9.17-4.16a2 2 0 0 0-1.66 0L2 12.65"/></svg>
        Bắt đầu tạo
      </button>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);