# Stage 1: Build the React app
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Declare the build argument
ARG REACT_APP_SOCKET_URL
# Set it as an environment variable for the build process
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}

# Build the application
RUN npm run build

# Stage 2: Serve the built app with Nginx
FROM nginx:stable-alpine
COPY --from=builder /usr/src/app/build /usr/share/nginx/html

# Optional: Copy a custom Nginx configuration if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (default Nginx port)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
