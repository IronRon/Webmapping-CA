FROM nginx:alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/

# Copy SSL certs (safe even if empty)
COPY ssl/ /etc/nginx/ssl/

# Create static & media directories
RUN mkdir -p /app/staticfiles /app/media

# Permissions
RUN chmod 755 /app/staticfiles /app/media

EXPOSE 80 443
