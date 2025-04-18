// utils/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qvfwlljzlskhpvjqsntt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZndsbGp6bHNraHB2anFzbnR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4NDM2NTksImV4cCI6MjA2MDQxOTY1OX0.sP4Gwxs2IXyAK3X47nimGPMQNUzU9Pxp3sAX03szsco';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
