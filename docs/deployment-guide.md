# Deployment guide

Three ways to publish things from this project.

## A. The visualizer on GitHub Pages (free static hosting)

1. Create a GitHub repo named `ubuntu-ec2-visual` and push this folder (`git init`, `git add .`, `git commit`, `git remote add origin …`, `git push -u origin main`).
2. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. Open `https://<your-user>.github.io/ubuntu-ec2-visual/`.

## B. The CloudFlix website on a real Ubuntu 24.04 EC2 instance

### 1. Launch

- AMI **Ubuntu Server 24.04 LTS**, type `t3.micro` (subject to account eligibility/availability), key pair `.pem`, public subnet with auto-assigned public IP, 8 GiB gp3.
- Security Group: **SSH 22 from My IP**, **HTTP 80 from 0.0.0.0/0**, (optional) **HTTPS 443 from 0.0.0.0/0**.

### 2. Connect

```bash
chmod 400 key.pem
ssh -i key.pem ubuntu@<PUBLIC-IP>
```

### 3. Install NGINX

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install nginx -y
sudo systemctl enable --now nginx
curl -I http://localhost        # expect HTTP/1.1 200 OK
```

### 4. Upload the site

```bash
# from your laptop (project root)
scp -i key.pem -r assets/website ubuntu@<PUBLIC-IP>:~/website
```

### 5. Publish

```bash
# on the server
sudo cp -r website/* /var/www/html/
curl http://localhost | head
```

Browse to `http://<PUBLIC-IP>`. If you still see “Welcome to nginx!”, check that `index.html` is directly inside `/var/www/html/` (not in a sub-folder).

### Alternative: clone or ZIP

```bash
sudo apt update
sudo apt install nginx git -y
git clone https://github.com/Cloud-Messenger/ubuntu-ec2-visual.git   # placeholder until published
sudo cp -r ubuntu-ec2-visual/* /var/www/html/
sudo systemctl enable --now nginx
```

```bash
# ZIP over SCP
scp -i key.pem ubuntu-ec2-visual.zip ubuntu@<PUBLIC-IP>:~
sudo apt install unzip -y && unzip ubuntu-ec2-visual.zip
sudo cp -r ubuntu-ec2-visual/* /var/www/html/
```

The commands assume the right working directory and sufficient permissions (`sudo`).

## C. HTTPS (optional)

HTTPS needs a domain name that points at the instance (ideally an **Elastic IP**), port 443 open and a certificate:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d example.com
```

## D. Clean up

Stop or **terminate** the instance, release any Elastic IP and delete unused EBS volumes when you are done, so you are not billed.
