import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-graduation-cap text-primary-foreground text-xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Chrona</h1>
              <p className="text-muted-foreground">Smart Timetable Management</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Streamline Your School Scheduling
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Generate optimized timetables with AI-powered scheduling, manage teacher substitutions, 
            and access comprehensive school data management - all in one powerful platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-3" asChild>
              <a href="/api/login" data-testid="button-login">
                <i className="fas fa-sign-in-alt mr-2"></i>
                Sign In with Replit
              </a>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              <i className="fas fa-play mr-2"></i>
              View Demo
            </Button>
          </div>
        </header>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-magic text-white text-xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3">AI-Powered Generation</h3>
            <p className="text-muted-foreground">
              Automatically generate optimal timetables using advanced constraint satisfaction algorithms
            </p>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-user-friends text-white text-xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3">Smart Substitutions</h3>
            <p className="text-muted-foreground">
              Manage teacher absences with intelligent substitute recommendations and automatic updates
            </p>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-upload text-white text-xl"></i>
            </div>
            <h3 className="text-xl font-semibold mb-3">Easy Data Import</h3>
            <p className="text-muted-foreground">
              Upload teacher, subject, and class data effortlessly using CSV files or manual entry
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h3 className="text-3xl font-bold mb-6">Why Choose Chrona?</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-primary-foreground text-sm"></i>
                </div>
                <div>
                  <h4 className="font-semibold">Constraint-Based Optimization</h4>
                  <p className="text-muted-foreground">Ensures no teacher conflicts and balanced workload distribution</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-primary-foreground text-sm"></i>
                </div>
                <div>
                  <h4 className="font-semibold">Multi-Role Access</h4>
                  <p className="text-muted-foreground">Designed for administrators, teachers, students, and parents</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fas fa-check text-primary-foreground text-sm"></i>
                </div>
                <div>
                  <h4 className="font-semibold">Real-time Updates</h4>
                  <p className="text-muted-foreground">Instant notifications for schedule changes and substitutions</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">100%</div>
                <div className="text-muted-foreground">Conflict-Free</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">50%</div>
                <div className="text-muted-foreground">Time Saved</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
                <div className="text-muted-foreground">Availability</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">∞</div>
                <div className="text-muted-foreground">Flexibility</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-card p-12 rounded-xl border border-border">
            <h3 className="text-3xl font-bold mb-4">Ready to Transform Your School Scheduling?</h3>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of schools already using Chrona for smarter timetable management
            </p>
            <Button size="lg" className="text-lg px-12 py-4" asChild>
              <a href="/api/login" data-testid="button-get-started">
                Get Started Now
              </a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}