FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy all source files
COPY . .

# Set environment variables for Next.js development server
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# We use the dev server so environment variables like NEXT_PUBLIC_API_URL 
# can be read dynamically at runtime instead of being baked in during a build step.
CMD ["npm", "run", "dev"]
