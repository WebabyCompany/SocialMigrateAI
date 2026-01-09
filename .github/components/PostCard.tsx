import React from 'react';
import { Post } from '../types';

interface PostCardProps {
  post: Post;
  isSelected: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, isSelected, onToggle, readOnly = false }) => {
  return (
    <div 
      className={`
        relative flex flex-col bg-white rounded-lg shadow-sm border transition-all duration-200 overflow-hidden
        ${isSelected ? 'ring-2 ring-facebook-blue border-facebook-blue' : 'border-gray-200 hover:border-gray-300'}
        ${readOnly ? 'opacity-90' : 'cursor-pointer'}
      `}
      onClick={() => !readOnly && onToggle(post.id)}
    >
      {/* Selection Checkbox */}
      {!readOnly && (
        <div className="absolute top-3 right-3 z-10">
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center border transition-colors duration-200
            ${isSelected ? 'bg-facebook-blue border-facebook-blue' : 'bg-white border-gray-300'}
          `}>
            {isSelected && <i className="fas fa-check text-white text-xs"></i>}
          </div>
        </div>
      )}

      {/* Image Header (Optional) */}
      {post.imageUrl && (
        <div className="w-full h-32 bg-gray-100 overflow-hidden">
          <img src={post.imageUrl} alt="Post attachment" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex-1">
        <div className="flex items-center mb-2">
          <div className="text-xs text-gray-500 font-medium">{post.date}</div>
        </div>
        <p className="text-gray-800 text-sm leading-relaxed mb-3">
          {post.content}
        </p>
        
        {/* Footer info */}
        <div className="mt-auto flex items-center text-gray-500 text-xs gap-4">
          <span className="flex items-center gap-1">
            <i className="fas fa-thumbs-up"></i> {post.likes}
          </span>
          <span className="flex items-center gap-1">
             <i className="fas fa-user"></i> {post.originalAuthor}
          </span>
        </div>
      </div>
    </div>
  );
};