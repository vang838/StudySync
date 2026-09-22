import Header from "@/components/ui/header";
import Sidebars from "@/components/ui/authenticated_sidebar";
import PublicHomepage from "@/app/main/public_homepage/page";


export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header/>
      {/*Need to provide code where it is accessible for authenticated users*/}
      <Sidebars>
        {/*This is where I put the main contents on to here. */}
        <PublicHomepage/>
      </Sidebars>
    </div>
  );
}
