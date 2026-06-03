import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { uploadGuidanceImage, GuidanceImageUploadError, deleteGuidanceImage } from './guidanceImageUpload';
import type { GuidanceImage } from '../core/store/useAppStore';

interface GuidanceEditorProps {
  value: string;
  onChange: (value: string) => void;
  guidanceImages: GuidanceImage[];
  onImagesChange: (images: GuidanceImage[]) => void;
  stageId?: string;
  placeholder?: string;
  rows?: number;
}

export default function GuidanceEditor({
  value,
  onChange,
  guidanceImages,
  onImagesChange,
  stageId,
  placeholder = '支持 Markdown 语法，拖拽或粘贴图片自动上传',
  rows = 5,
}: GuidanceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    { kind: 'idle' } | { kind: 'uploading'; name: string } | { kind: 'error'; msg: string }
  >({ kind: 'idle' });

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + text.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const runUpload = async (file: File) => {
    setUploadStatus({ kind: 'uploading', name: file.name });
    try {
      const result = await uploadGuidanceImage(file, stageId);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\r\n]/g, ' ').trim() || 'image';
      insertAtCursor(`![${alt}]({image:${result.imageId}})`);
      onImagesChange([...guidanceImages, { id: result.imageId, url: result.url, alt }]);
      setUploadStatus({ kind: 'idle' });
    } catch (e) {
      const message = e instanceof GuidanceImageUploadError ? e.message : String(e);
      setUploadStatus({ kind: 'error', msg: message });
      setTimeout(() => setUploadStatus({ kind: 'idle' }), 4000);
    }
  };

  const runUploads = async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    for (const file of images) {
      await runUpload(file);
    }
  };

  const removeImage = (imageId: string) => {
    onImagesChange(guidanceImages.filter(img => img.id !== imageId));
    if (stageId) void deleteGuidanceImage(imageId, stageId);
  };

  // 预处理：将 {image:id} 占位符替换为真实 URL
  const resolvedGuidance = value.replace(/\{image:([a-z0-9_]+)\}/g, (_match, id) => {
    const found = guidanceImages.find(img => img.id === id);
    return found?.url ?? _match;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
          学习指导 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（可选，支持 Markdown，可贴/拖图片）</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {uploadStatus.kind === 'uploading' && (
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>⏳ 上传中：{uploadStatus.name}</span>
          )}
          {uploadStatus.kind === 'error' && (
            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>⚠️ {uploadStatus.msg}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) runUploads(files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus.kind === 'uploading'}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            📷 插入图片
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        onPaste={(e) => {
          const items = Array.from(e.clipboardData?.items ?? []);
          const images: File[] = [];
          for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
              const f = item.getAsFile();
              if (f) images.push(f);
            }
          }
          if (images.length > 0) {
            e.preventDefault();
            runUploads(images);
          }
        }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
          if (files.length > 0) {
            e.preventDefault();
            runUploads(files);
          }
        }}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: '8px',
          border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box',
          fontFamily: 'inherit', resize: 'vertical', minHeight: '120px',
        }}
      />

      {/* 已上传图片列表 */}
      {guidanceImages.length > 0 && (
        <div style={{ marginTop: '8px', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, marginBottom: '8px' }}>已上传图片</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {guidanceImages.map(img => (
              <div key={img.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <img src={img.url} alt={img.alt ?? ''} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                <span style={{ fontSize: '0.78rem', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.alt || img.id}</span>
                <button onClick={() => removeImage(img.id)} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>删除</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markdown 预览 */}
      {value.trim() && (
        <details open style={{ marginTop: '8px', background: '#f9fafb', borderRadius: '8px', padding: '10px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>👁 预览</summary>
          <div style={{ marginTop: '8px', color: '#374151', fontSize: '0.95rem', lineHeight: 1.65 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt ?? ''}
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }}
                  />
                ),
              }}
            >
              {resolvedGuidance}
            </ReactMarkdown>
          </div>
        </details>
      )}
    </div>
  );
}
