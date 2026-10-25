import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import OffersPopup from "@/components/public/OffersPopup";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main id="main-content" role="main">
        {children}
      </main>
      <OffersPopup />
      <Footer />
    </>
  );
}
