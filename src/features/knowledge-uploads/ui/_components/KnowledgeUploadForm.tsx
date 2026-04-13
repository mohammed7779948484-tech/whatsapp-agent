'use client';

import { useRef, useState, useTransition } from 'react';

import { uploadKnowledgeFile } from '../../actions/upload-knowledge-file.action';

export function KnowledgeUploadForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!file) {
      setMessage('Select a PDF or CSV file to continue.');
      setMessageType('error');
      return;
    }

    const formData = new FormData();
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadKnowledgeFile(formData);

      if (!result.success) {
        setMessage(result.error);
        setMessageType('error');
        return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setMessage('Upload queued successfully.');
      setMessageType('success');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="knowledge-file" className="mb-2 block text-sm font-medium text-slate-700">
          Upload PDF or CSV
        </label>
        <input
          id="knowledge-file"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? 'Uploading...' : 'Upload file'}
      </button>

      {message && messageType ? (
        <p
          className={`text-sm ${
            messageType === 'success' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
