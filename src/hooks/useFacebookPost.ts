import { useState } from 'react';

interface FacebookPostData {
  message: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  scheduleTime?: string | number;
  platforms?: ('facebook' | 'instagram')[];
}

interface FacebookPostResponse {
  success: boolean;
  postId?: string; // Legacy fallback or main id
  results?: {
    facebook?: string;
    instagram?: string;
  };
  error?: string;
  fbError?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}


export function useFacebookPost() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  const postToFacebook = async (data: FacebookPostData) => {
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
        body: JSON.stringify(data),
      });

      const result: FacebookPostResponse = await response.json();

      if (result.success) {
        setSuccess(true);
        // Store both IDs if available, or fallback to the single postId, or the facebook one
        setPostId(result.results?.facebook || result.results?.instagram || result.postId || null);
      } else {
        const detail = result.fbError ? ` (${result.fbError.type}: ${result.fbError.message})` : '';
        setError((result.error || 'Failed to post to Facebook') + detail);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFacebookPost = async (fbPostId: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/facebook-post/${fbPostId}`, {
        method: 'DELETE',
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        // If it's not JSON, maybe it's still a success if status is 200-299
        if (response.ok) {
          setSuccess(true);
          return true;
        }
        throw new Error(`Server returned non-JSON error: ${text.substring(0, 100)}`);
      }

      if (result.success) {
        setSuccess(true);
        return true;
      } else {
        setError(result.error || 'Failed to delete post from Facebook');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateFacebookPost = async (fbPostId: string, newMessage?: string, newScheduleTime?: number) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: any = {};
      if (newMessage !== undefined) payload.message = newMessage;
      if (newScheduleTime !== undefined) payload.scheduled_publish_time = newScheduleTime;

      const response = await fetch(`/api/facebook-post/${fbPostId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        return true;
      } else {
        setError(result.error || 'Failed to update post on Facebook');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  const getPostMetrics = async (fbPostId: string, platform: 'facebook' | 'instagram' = 'facebook') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meta-post/${fbPostId}/metrics?platform=${platform}`);
      const result = await response.json();

      if (result.success) {
        return result.metrics;
      } else {
        setError(result.error || 'Failed to fetch metrics');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      return null;
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
    postToFacebook,
    deleteFacebookPost,
    updateFacebookPost,
    getPostMetrics,
    isLoading,
    error,
    success,
    postId,
    resetStatus
  };
}
