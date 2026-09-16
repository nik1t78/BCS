import React, { useState, useEffect } from 'react';
import { Attachment } from '../types';
import { getAttachments, addAttachment, deleteAttachment, generateId } from '../store';

interface AttachmentsProps {
  meetingId: string;
  userId: string;
}

export default function Attachments({ meetingId, userId }: AttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setAttachments(getAttachments(meetingId));
  }, [meetingId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Проверка размера (10 MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Файл ${file.name} слишком большой. Максимум 10 MB.`);
        continue;
      }

      // В реальном приложении здесь была бы загрузка на сервер
      // Для демо сохраняем метаданные в localStorage
      const attachment: Attachment = {
        id: generateId(),
        meetingId,
        userId,
        fileName: file.name,
        filePath: URL.createObjectURL(file),
        fileSize: file.size,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      };

      addAttachment(attachment);
    }

    setAttachments(getAttachments(meetingId));
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить файл?')) {
      deleteAttachment(id);
      setAttachments(getAttachments(meetingId));
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.filePath;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'fa-image';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
    if (mimeType.startsWith('video/')) return 'fa-file-video';
    if (mimeType.startsWith('audio/')) return 'fa-file-audio';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'fa-file-archive';
    return 'fa-file';
  };

  const getFileIconColor = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'text-green-500';
    if (mimeType.includes('pdf')) return 'text-red-500';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'text-blue-500';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'text-green-600';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'text-orange-500';
    if (mimeType.startsWith('video/')) return 'text-purple-500';
    if (mimeType.startsWith('audio/')) return 'text-pink-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          <i className="fas fa-paperclip mr-2 text-blue-500"></i>
          Вложения ({attachments.length})
        </h3>
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <i className="fas fa-upload mr-2"></i>
          {uploading ? 'Загрузка...' : 'Загрузить файл'}
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <i className="fas fa-info-circle mr-2"></i>
          Максимальный размер файла: 10 MB. Поддерживаемые форматы: PDF, DOCX, XLSX, PPTX, изображения, видео.
        </p>
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
            >
              <div className={`text-2xl ${getFileIconColor(attachment.mimeType)}`}>
                <i className={`fas ${getFileIcon(attachment.mimeType)}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                  {attachment.fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatFileSize(attachment.fileSize)} • {new Date(attachment.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Скачать"
                >
                  <i className="fas fa-download"></i>
                </button>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Удалить"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <i className="fas fa-paperclip text-4xl mb-3"></i>
          <p>Нет вложений</p>
          <p className="text-sm mt-1">Загрузите файлы для этой конференции</p>
        </div>
      )}
    </div>
  );
}
