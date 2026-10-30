import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import OffersPopup from "@/components/public/OffersPopup";
import StoreStatusBanner from "@/components/public/StoreStatusBanner";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <StoreStatusBanner />
      <main id="main-content" role="main">
        {children}
      </main>
      <OffersPopup />
      <Footer />
      <BottomNav />
    </>
  );
}
