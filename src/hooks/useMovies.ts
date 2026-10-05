import { useQuery } from "@tanstack/react-query";

// Mock data simulating what your backend/provider will return
const mockFetchMovies = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 1000);
  });

  return [
    {
      id: "1",
      title: "Inception",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHNeeR0apUAjeN32qqGAOWnUl6MHkOSvOL8KvZMdZPQA&s=10",
    },
    {
      id: "2",
      title: "Interstellar",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRN6MBU9VxzNxqU0gzzOsgDR0Mpxn4_6BDHIzD-Xc8YaQ&s=10",
    },
    {
      id: "3",
      title: "The Dark Knight",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRep9jnXBfTJNK1b_xscEPqUeIN59uqMkx1P9b1uFe-YA&s=10",
    },
  ];
};

export const useMovies = () => {
  return useQuery({
    queryKey: ["movies"], // Unique identifier for caching
    queryFn: mockFetchMovies,
  });
};
