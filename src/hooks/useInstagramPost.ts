import { useState } from 'react';

interface InstagramPostData {
  message: string;
  mediaUrls: string[];
}

interface InstagramPostResponse {
  success: boolean;
  postId?: string;
  error?: string;
}

export function useInstagramPost() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  const postToInstagram = async (data: InstagramPostData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setPostId(null);

    try {
      const response = await fetch('/api/meta-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          platforms: ['instagram'],
        }),
      });

      const result: any = await response.json();

      if (result.success) {
        setSuccess(true);
        setPostId(result.results?.instagram || result.postId || null);
      } else {
        setError(result.error || 'Failed to post to Instagram');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetStatus = () => {
    setIsLoading(false);
    setError(null);
    setSuccess(false);
    setPostId(null);
  };

  return {
    postToInstagram,
    isLoading,
    error,
    success,
    postId,
    resetStatus
  };
}
