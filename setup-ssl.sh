#!/bin/bash

# SSL Setup Script for api.akleao.com
# Run this script to set up HTTPS for your API gateway

set -e

echo "=========================================="
echo "SSL Setup for api.akleao.com"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Create firewall rule
echo -e "${BLUE}Step 1: Creating firewall rule for HTTP/HTTPS...${NC}"
gcloud compute firewall-rules create allow-http-https \
    --allow tcp:80,tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --target-tags http-server,https-server \
    --project akleao-finance-v0 || echo "Firewall rule may already exist"

echo -e "${GREEN}✓ Firewall rule configured${NC}"
echo ""

# Step 2: SSH into VM and install nginx + certbot
echo -e "${BLUE}Step 2: Installing nginx and certbot on VM...${NC}"
gcloud compute ssh akleao-workers --zone=us-central1-a --project=akleao-finance-v0 --command="
    set -e
    echo 'Updating packages...'
    sudo apt update -qq

    echo 'Installing nginx and certbot...'
    sudo apt install -y nginx certbot python3-certbot-nginx

    echo 'Stopping nginx temporarily...'
    sudo systemctl stop nginx

    echo '✓ nginx and certbot installed'
"

echo -e "${GREEN}✓ nginx and certbot installed${NC}"
echo ""

# Step 3: Get SSL certificate
echo -e "${BLUE}Step 3: Obtaining SSL certificate...${NC}"
echo "Waiting 30 seconds for DNS propagation..."
sleep 30

gcloud compute ssh akleao-workers --zone=us-central1-a --project=akleao-finance-v0 --command="
    set -e
    sudo certbot certonly --standalone \
        -d api.akleao.com \
        --email cameronplanck@gmail.com \
        --agree-tos \
        --non-interactive \
        --no-eff-email
"

echo -e "${GREEN}✓ SSL certificate obtained${NC}"
echo ""

# Step 4: Configure nginx
echo -e "${BLUE}Step 4: Configuring nginx reverse proxy...${NC}"
gcloud compute ssh akleao-workers --zone=us-central1-a --project=akleao-finance-v0 --command="
    set -e

    # Create nginx config
    sudo tee /etc/nginx/sites-available/api.akleao.com > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.akleao.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.akleao.com;

    ssl_certificate /etc/letsencrypt/live/api.akleao.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.akleao.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/api.akleao.com /etc/nginx/sites-enabled/

    # Test configuration
    sudo nginx -t

    # Start nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx

    echo '✓ nginx configured and started'
"

echo -e "${GREEN}✓ nginx reverse proxy configured${NC}"
echo ""

# Step 5: Test endpoint
echo -e "${BLUE}Step 5: Testing HTTPS endpoint...${NC}"
sleep 5

if curl -s -o /dev/null -w "%{http_code}" https://api.akleao.com/health | grep -q "200"; then
    echo -e "${GREEN}✓ HTTPS endpoint is working!${NC}"
    echo ""
    echo "Testing actual response:"
    curl -s https://api.akleao.com/health | head -n 10
else
    echo "Endpoint not ready yet. DNS may still be propagating."
    echo "Try manually: curl https://api.akleao.com/health"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Your API is now available at: https://api.akleao.com"
echo ""
echo "Next steps:"
echo "1. Update .env.local: NEXT_PUBLIC_API_URL=https://api.akleao.com"
echo "2. Update Vercel environment variable"
echo "3. Rebuild and redeploy"
