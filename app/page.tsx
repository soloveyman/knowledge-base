import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            HORECA SaaS Platform
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Complete solution for restaurants, hotels, and catering businesses
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Management</CardTitle>
              <CardDescription>
                Manage your restaurant operations efficiently
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Get Started</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hotel Services</CardTitle>
              <CardDescription>
                Streamline hotel and accommodation services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Learn More</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catering Solutions</CardTitle>
              <CardDescription>
                Professional catering management tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Explore</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
