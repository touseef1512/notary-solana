import { NextResponse } from 'next/server';

export const GET = async () => {
  const payload = {
    rules: [
      {
        pathPattern: "/registry/*",
        apiPath: "/api/actions/verify/*"
      },
      {
        pathPattern: "/verify/*",
        apiPath: "/api/actions/verify/*"
      }
    ]
  };

  return NextResponse.json(payload, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
    }
  });
};

export const OPTIONS = async () => {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
    }
  });
};
