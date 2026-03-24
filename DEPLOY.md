# 部署指南

## 架构

```
riffnote.app      → Cloudflare Pages（前端 SPA）
api.riffnote.app  → AWS EC2 t4g.micro（FastAPI + PostgreSQL + Nginx）
```

Cloudflare 统一处理 SSL，EC2 只需监听 HTTP。

## 1. EC2 后端

### 创建实例

- AMI: Ubuntu 24.04 LTS (ARM64)
- 实例类型: t4g.micro（免费套餐 / 约 $6/月）
- 存储: 20GB gp3
- 安全组: 开放 22 (SSH)、80 (HTTP)
- 分配一个弹性 IP

### DNS 配置

在 Cloudflare DNS 中添加 A 记录：

```
api.riffnote.app → <EC2 弹性 IP>（Proxy 开启，橙色云朵）
```

Cloudflare 代理会自动处理 SSL，请求以 HTTP 转发到 EC2。

### 安装依赖

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv python3-pip \
  postgresql postgresql-contrib nginx git
```

### 配置 PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER riffnote WITH PASSWORD '你的密码';
CREATE DATABASE riffnote OWNER riffnote;
\q
```

### 拉取代码 & 安装

```bash
cd /opt
sudo git clone https://github.com/haipome/riffnote.git
sudo chown -R ubuntu:ubuntu /opt/riffnote

cd /opt/riffnote/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 环境变量

```bash
cat > /opt/riffnote/backend/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://riffnote:你的密码@localhost:5432/riffnote
CLERK_SECRET_KEY=sk_live_xxx
CLERK_PUBLISHABLE_KEY=pk_live_xxx
GEMINI_API_KEY=xxx
CORS_ORIGINS=https://riffnote.app
UPLOAD_DIR=/opt/riffnote/backend/uploads
EOF
```

### 运行数据库迁移

```bash
cd /opt/riffnote/backend
source .venv/bin/activate
alembic upgrade head
```

### 配置 Systemd 服务

```bash
sudo tee /etc/systemd/system/riffnote.service << 'EOF'
[Unit]
Description=RiffNote API
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/opt/riffnote/backend
ExecStart=/opt/riffnote/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
Environment=PATH=/opt/riffnote/backend/.venv/bin:/usr/bin

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable riffnote
sudo systemctl start riffnote
```

验证：`curl http://127.0.0.1:8000/api/health`

### 配置 Nginx

```bash
sudo tee /etc/nginx/sites-available/riffnote-api << 'EOF'
server {
    listen 80;
    server_name api.riffnote.app;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/riffnote-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 2. Cloudflare Pages 前端

### 连接仓库

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → 创建项目
2. 连接 GitHub 仓库 `haipome/riffnote`
3. 构建配置：
   - **根目录**: `frontend`
   - **构建命令**: `npm run build`
   - **输出目录**: `build/client`
   - **环境变量**: `NODE_VERSION=20`

### 环境变量

```
VITE_API_BASE=https://api.riffnote.app
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

### 自定义域名

1. Cloudflare Pages → 自定义域 → 添加 `riffnote.app`
2. Cloudflare 自动处理 DNS 和 SSL

### 自动部署

Push 到 `main` 分支会自动触发构建和部署，无需额外配置。

## 3. Clerk 配置

在 [Clerk Dashboard](https://dashboard.clerk.com) 中：

1. 创建 **Production** 实例（或从 Development 切换）
2. 添加域名：`riffnote.app`
3. 将 `pk_live_` 和 `sk_live_` 密钥分别配置到前端和后端环境变量

## 4. 更新部署

### 后端

```bash
cd /opt/riffnote
git pull
cd backend
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart riffnote
```

### 前端

Push 到 GitHub，Cloudflare Pages 自动部署。

## 5. 常用运维命令

```bash
# 服务管理
sudo systemctl restart riffnote       # 重启后端
sudo systemctl stop riffnote          # 停止后端
sudo systemctl status riffnote        # 查看服务状态

# 日志
sudo journalctl -u riffnote -f        # 实时查看后端日志
sudo journalctl -u riffnote --since "1h ago"  # 最近 1 小时日志

# Nginx
sudo nginx -t && sudo systemctl reload nginx  # 测试并重载配置
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 数据库
sudo -u postgres psql -d riffnote     # 进入数据库
```
