import { api } from '@/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { Id } from '@/convex/_generated/dataModel';

export async function POST(request: Request) {
  try {
    // Parse request body to get adminId
    const body = await request.json();
    const { adminId } = body;

    if (!adminId) {
      return Response.json(
        { error: 'Missing required field: adminId' },
        { status: 400 }
      );
    }

    // Initialize Convex client
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is not set');
    }

    const convex = new ConvexHttpClient(convexUrl);

    // Call the logo migration mutation
    const result = await convex.mutation(api.admin.runLogoMigration, {
      adminId: adminId as Id<'users'>,
    });

    return Response.json({
      success: true,
      data: result,
      message: 'Logo migration completed successfully',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error for debugging
    console.error('Logo migration error:', errorMsg);
    
    return Response.json(
      { 
        error: 'Logo migration failed',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
