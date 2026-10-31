'use client';

import React, { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { parseTagsInput, MAX_TAGS } from '@/lib/vault-logic';
import { cn } from '@/lib/utils';

/**
 * Free-form tag editor — type + Enter/comma to add, click X to remove.
 * The parent receives the parsed tag array on every change.
 */
interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  inputId: string;
  compact?: boolean;
}

export function TagsInput({ tags, onChange, inputId, compact = false }: TagsInputProps) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    if (!draft.trim()) return;
    const next = parseTagsInput([...tags, draft].join(','));
    onChange(next);
    setDraft('');
  };

  const full = tags.length >= MAX_TAGS;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={cn(
          'flex items-center gap-1.5 font-bold text-slate-700',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <Tag className="w-3.5 h-3.5 text-mint-600" />
        תגיות (מופרדות בפסיק — עד {MAX_TAGS}):
      </label>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg bg-mint-500/10 border border-mint-500/25 text-xs font-bold text-mint-700"
            >
              <span className="truncate max-w-[12rem]">{tag}</span>
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                aria-label={`הסרת תגית ${tag}`}
                className="text-mint-600 hover:text-red-600 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          disabled={full}
          onChange={(e) => {
            setDraft(e.target.value);
            // Typing a comma commits immediately.
            if (e.target.value.includes(',')) commitDraft();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={full ? 'הגעת למקסימום תגיות' : 'למשל: חשוב, עבודה, 2026...'}
          className="input-glass flex-1"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={full || !draft.trim()}
          className="btn-accent min-h-11 px-4 rounded-xl text-sm font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          הוסף
        </button>
      </div>
    </div>
  );
}
