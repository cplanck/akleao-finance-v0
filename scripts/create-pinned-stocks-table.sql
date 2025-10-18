-- Create pinned_stocks table
CREATE TABLE IF NOT EXISTS pinned_stocks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, symbol),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pinned_stocks_user_id ON pinned_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_stocks_position ON pinned_stocks(user_id, position);
