import React, { useState, useEffect } from 'react';
import { getTags } from '../store';

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface TagsSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagsSelector({ selectedTags, onTagsChange }: TagsSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const data = localStorage.getItem('vks_tags');
    if (data) {
      setTags(JSON.parse(data));
    }
  }, []);

  const toggleTag = (tagId: string) => {
    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    onTagsChange(newTags);
  };

  if (tags.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          Нет доступных тегов. Создайте теги в разделе "Теги".
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`px-3 py-1 rounded-full text-sm border-2 transition-all ${
              selectedTags.includes(tag.id)
                ? 'border-current opacity-100'
                : 'border-transparent opacity-60 hover:opacity-80'
            }`}
            style={{ 
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: selectedTags.includes(tag.id) ? tag.color : 'transparent'
            }}
          >
            {selectedTags.includes(tag.id) && <i className="fas fa-check mr-1"></i>}
            {tag.name}
          </button>
        ))}
      </div>
      {selectedTags.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Выбрано тегов: {selectedTags.length}
        </p>
      )}
    </div>
  );
}
