-- Create user_api_keys table for storing encrypted OpenAI API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- Create openai_usage table for tracking API usage and costs
CREATE TABLE IF NOT EXISTS openai_usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  last_request_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, date),
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_user_id ON openai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_openai_usage_date ON openai_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_openai_usage_last_request ON openai_usage(last_request_at);

-- Add comments for documentation
COMMENT ON TABLE user_api_keys IS 'Stores encrypted OpenAI API keys per user';
COMMENT ON COLUMN user_api_keys.encrypted_key IS 'AES-256 encrypted API key';
COMMENT ON TABLE openai_usage IS 'Tracks OpenAI API usage and estimated costs per user per day';
